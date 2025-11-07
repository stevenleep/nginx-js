# Contributing to nginx-js

Thank you for your interest in contributing to nginx-js! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

- Use the GitHub issue tracker
- Include a clear title and description
- Provide steps to reproduce
- Include environment information (browser, Node.js version, etc.)
- Include code examples if possible

### Suggesting Enhancements

- Use the GitHub issue tracker
- Clearly describe the enhancement
- Explain why it would be useful
- Provide examples of how it would be used

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Ensure tests pass (if applicable)
5. Commit your changes (`git commit -m 'Add some amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/stevenleep/nginx-js.git
cd nginx-js

# Install dependencies (using pnpm)
pnpm install

# Build the project
pnpm run build

# Run type checking
pnpm run type-check

# Run linting
pnpm run lint

# Format code
pnpm run format

# Run all checks (type-check + lint + format check)
pnpm run check
```

### Code Style

- Follow the existing code style
- Use TypeScript strict mode
- Write clear, self-documenting code
- Add comments for complex logic
- Follow the `.editorconfig` settings

### Commit Messages

- Use clear, descriptive commit messages
- Reference issues when applicable
- Follow conventional commit format when possible

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
