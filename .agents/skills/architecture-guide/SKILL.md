---
name: architecture-guide
description: Architecture guidelines and Feature MVC structure rules for the project. Use this when creating new features, endpoints, or services.
---

# Architecture Guide

This project follows a strict **Feature MVC** architecture structure. Whenever you are building a new feature or sub-feature, you MUST adhere to these architectural rules.

## Feature Structure

Each feature (and sub-feature) should reside in its own folder inside `src/feature/` and MUST contain a minimum of 4 distinct files to clearly separate concerns:

1. **Repository** (`[feature-name].repository.ts`): Handles all direct database access and Prisma queries. No business logic belongs here.
2. **Service** (`[feature-name].service.ts`): Contains the core business logic. Calls the repository layer for data.
3. **Route / Controller** (`[feature-name].route.ts`): Defines the Express routes, handles HTTP requests/responses, performs input validation, and calls the service layer.
4. **Types** (`[feature-name].types.ts`): Contains all feature-specific TypeScript interfaces, types, Zod schemas, and DTOs.

Features can have nested sub-features to maintain organization. For example:
- `src/feature/rbac/`
  - `src/feature/rbac/module/`
    - `module.repository.ts`
    - `module.service.ts`
    - `module.route.ts`
    - `module.types.ts`

## File Naming Conventions

- **Case**: Use strictly lowercase letters.
- **Spacing**: If a space is needed in a conceptual name, use a dash (`-`) (kebab-case). Example: `user-profile.repository.ts`.
- **Extensions**: Files MUST explicitly follow the `.role.ts` pattern indicating their architectural purpose (e.g., `.repository.ts`, `.service.ts`, `.route.ts`, `.types.ts`).

## Testing

Every feature MUST have an equivalent test file created in the `src/test/` directory. The test folder structure should mirror the feature folder structure.
- **Example**: If you build `src/feature/rbac/module/module.service.ts`, you must create `src/test/feature/rbac/module.test.ts`.
- **Tooling**: Always utilize the installed testing frameworks (`vitest` and `supertest`) to write robust unit and integration tests.

## Tool Utilization

Always utilize the tools and libraries already installed in the project rather than reinventing the wheel.
- Use **Zod** for schema validation and types.
- Use **Pino** for logging.
- Use **Express** standard patterns combined with your chosen API design skill guidelines.
