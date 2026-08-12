const assert = require("node:assert/strict");
const test = require("node:test");

const { detectPrivateIp, isPrivateIPv4 } = require("./detect-private-ip");

test("recognizes every RFC1918 IPv4 range", () => {
  assert.equal(isPrivateIPv4("10.20.30.40"), true);
  assert.equal(isPrivateIPv4("172.16.0.1"), true);
  assert.equal(isPrivateIPv4("172.31.255.254"), true);
  assert.equal(isPrivateIPv4("192.168.0.1"), true);

  assert.equal(isPrivateIPv4("172.15.255.254"), false);
  assert.equal(isPrivateIPv4("172.32.0.1"), false);
  assert.equal(isPrivateIPv4("203.0.113.10"), false);
  assert.equal(isPrivateIPv4("::1"), false);
});

test("prefers a physical interface over a virtual interface", () => {
  const interfaces = {
    docker0: [{ address: "172.17.0.1", family: "IPv4", internal: false }],
    en0: [{ address: "172.16.0.10", family: "IPv4", internal: false }],
  };

  assert.equal(detectPrivateIp(interfaces), "172.16.0.10");
});

test("fails with an actionable message when no private address exists", () => {
  const interfaces = {
    lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    en0: [{ address: "203.0.113.10", family: "IPv4", internal: false }],
  };

  assert.throws(
    () => detectPrivateIp(interfaces),
    /make dev-lan DEV_HOST=<private-ip>/,
  );
});
