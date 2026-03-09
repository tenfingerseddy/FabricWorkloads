# Contributing to Observability Workbench

Thanks for your interest in contributing! This project aims to solve the observability gap in Microsoft Fabric.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/FabricWorkloads.git`
3. Install dependencies: `npm install`
4. Set environment variables (see README.md)
5. Run: `npm start`

## Development

```bash
# Type check
npx tsc --noEmit

# Run collector only
npm run collect

# Run dashboard only
npm run dashboard

# Run continuous monitoring
npm run monitor
```

## Project Structure

```
src/           # CLI tool source (TypeScript)
workload/      # Fabric workload (Extensibility Toolkit)
notebooks/     # Fabric notebooks (PySpark)
scripts/       # Utility scripts
docs/          # Documentation
specs/         # Product specifications
landing-page/  # Marketing site
```

## What We Need Help With

- **Fabric API coverage** -- Adding support for more item types and APIs
- **KQL queries** -- Better analytical queries for the Eventhouse
- **Correlation strategies** -- More ways to link related Fabric items
- **Testing** -- Unit tests, integration tests with mock Fabric APIs
- **Documentation** -- Guides, examples, API reference

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure `npx tsc --noEmit` passes
4. Submit a PR with a clear description

## Code Style

- TypeScript strict mode
- No `any` types (use `unknown` + type narrowing)
- Descriptive variable names
- Handle errors gracefully (especially Fabric API errors)

## Reporting Issues

Use GitHub Issues with the provided templates. Include your Fabric environment details (capacity SKU, item types involved) when relevant.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
