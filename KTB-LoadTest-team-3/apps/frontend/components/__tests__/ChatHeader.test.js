import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChatHeader from '../ChatHeader';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: vi.fn(),
  }),
}));

describe('ChatHeader', () => {
  it('renders inside the app router chat page', () => {
    render(<ChatHeader />);

    expect(screen.getByTestId('chat-list-link')).toBeInTheDocument();
  });
});
