# Useful links:

- Celons GitHub URL: https://github.com/celonis

# Jira instructions

- The default jira project is Quality Engineering
- The default Jira epic is QE-670
- The Quality Engineering project also contains a ticket type called Test Case
- The Quality Engineering project also contains a ticket type called Test Plan
- The Summary of the test plan should be based on the Epic it relates to

# Jira Templates
- The default Test Plan template should be used from the Minimal examples Test Plan section below.

Minimal examples
- Test Plan
  ```
Scope of Testing
----------------

Test Types and Phases
---------------------

1.  Feature/change testing (feature flag enabled)

    *   Exploratory and Bug Bash

    *   Functional

    *   Non-functional

        *   **Cross-browser (Compatibility)**

        *   **Localization**

        *   **Performance**

        *   **Security**

        *   **Accessibility**

    *   Unit, API, and component tests (CI/CD)

    *   Automated E2E testing / User Journeys

2.  Regression Testing (feature flag enabled and disabled)

    *   Regression Types

        *   **Basic/Sanity Regression**

        *   **Full Regression**

        *   **Partial Regression**

    *   Risk-Based Testing

    *   Cross-Services Dependency Testing

        *   **Risk-Based Regression for Dependent Services**


Test Environment and Test Data
------------------------------

Test Schedule
-------------

Risk Management
---------------

Defect Management
-----------------

  ```