const os = require("node:os");
const net = require("node:net");

const PHYSICAL_INTERFACE_PATTERN = /^(en\d+|enp|eno|ens|eth|wlan|wl)/;
const VIRTUAL_INTERFACE_PATTERN =
  /^(awdl|br-|docker|llw|tap|tun|utun|veth|vmnet)/;

function isPrivateIPv4(address) {
  if (!net.isIPv4(address)) {
    return false;
  }

  const [first, second] = address.split(".").map(Number);
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function interfacePriority(name) {
  if (PHYSICAL_INTERFACE_PATTERN.test(name)) {
    return 0;
  }
  if (VIRTUAL_INTERFACE_PATTERN.test(name)) {
    return 2;
  }
  return 1;
}

function detectPrivateIp(interfaces = os.networkInterfaces()) {
  const candidates = Object.entries(interfaces)
    .flatMap(([name, addresses]) =>
      (addresses || []).map((address) => ({ name, ...address })),
    )
    .filter(
      ({ address, family, internal }) =>
        !internal &&
        (family === "IPv4" || family === 4) &&
        isPrivateIPv4(address),
    )
    .sort(
      (left, right) =>
        interfacePriority(left.name) - interfacePriority(right.name),
    );

  if (candidates.length === 0) {
    throw new Error(
      "No private IPv4 address found. Run make dev-lan DEV_HOST=<private-ip>.",
    );
  }

  return candidates[0].address;
}

if (require.main === module) {
  try {
    process.stdout.write(`${detectPrivateIp()}\n`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { detectPrivateIp, isPrivateIPv4 };
