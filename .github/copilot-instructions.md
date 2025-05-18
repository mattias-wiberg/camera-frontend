# Timelapse Camera Frontend Coding Instructions

## Project Overview
This is a React-based camera frontend for a timelapse application that captures webcam images and sends them to a backend service.

## Technology Stack
- React with TypeScript
- Vite as the build tool
- Shadcn/UI for component styling
- Flexbox for layout positioning

## Coding Standards
- Use TypeScript for type safety
- Use functional components with React hooks
- Follow component-based architecture
- Prefer arrow function syntax for component definitions
- Use async/await for asynchronous operations
- Use Shadcn/UI components instead of custom-styled ones
- Use the native Fetch API for network requests

## Component Guidelines
- Keep components small and focused on a single responsibility
- Follow Shadcn/UI conventions for component usage
- Use the cn utility for class name merging
- Implement proper error handling for API calls
- Ensure all components have proper TypeScript types

## Styling Guidelines
- Use Tailwind CSS classes via Shadcn/UI
- Use Flexbox for component positioning
- Do not create custom CSS classes except for layouts
- Follow the Shadcn/UI theming system
- Keep styling within component definitions when possible

## State Management
- Use React hooks (useState, useEffect, useRef) for state management
- Avoid prop drilling by keeping state close to where it's used
- Use useMemo and useCallback for optimization when needed

## Performance Considerations
- Optimize image handling to avoid memory leaks
- Implement proper cleanup in useEffect hooks
- Use React.memo for pure components that render often
