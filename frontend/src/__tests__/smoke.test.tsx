import '@testing-library/jest-dom'
import { render, screen, act } from '@testing-library/react'
import Page from '../app/page'

// Mock AuthContext
jest.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        user: { fullName: "Test User", role: "USER" },
        login: jest.fn(),
        logout: jest.fn()
    })
}));

// Mock Next Navigation
jest.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        prefetch: jest.fn()
    }),
    useSearchParams: () => ({
        get: jest.fn()
    })
}));

// Mock fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
    })
) as jest.Mock;

describe('Page', () => {
    it('renders a heading', async () => {
        await act(async () => {
            render(<Page />)
        })

        // Check for the main heading text from your Page component
        const heading = screen.getByText(/Booking & Facilities/i)
        expect(heading).toBeInTheDocument()
    })
})
