/**
 * @name AUSTA JavaScript/TypeScript Security Analysis
 * @description Healthcare-specific security queries for Next.js frontend
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id austa/javascript-security
 * @tags security healthcare frontend xss csrf
 */

import javascript

// XSS Prevention for Healthcare Forms
class HealthcareXSSVulnerability extends DataFlow::TrackedNode {
  HealthcareXSSVulnerability() {
    exists(DataFlow::CallNode call |
      call = this and
      call.getCalleeName() = "innerHTML" and
      call.getAnArgument().getStringValue().matches([
        "%patient%", "%health%", "%medical%", "%form%"
      ])
    )
  }
}

// Sensitive Healthcare Data Logging
class HealthcareDataLogging extends DataFlow::CallNode {
  HealthcareDataLogging() {
    this.getCalleeName() = ["console.log", "console.error", "console.warn"] and
    exists(StringLiteral str |
      this.getAnArgument() = str.flow() and
      str.getValue().matches([
        "%cpf%", "%ssn%", "%patient%", "%medical%", 
        "%health%", "%diagnosis%", "%prescription%"
      ])
    )
  }
}

// Insecure localStorage Usage for PHI
class InsecureLocalStorage extends DataFlow::CallNode {
  InsecureLocalStorage() {
    this.getReceiver().(DataFlow::GlobalVarNode).getName() = "localStorage" and
    this.getCalleeName() = "setItem" and
    exists(StringLiteral key |
      this.getArgument(0) = key.flow() and
      key.getValue().matches([
        "%patient%", "%health%", "%medical%", "%cpf%", "%ssn%"
      ])
    )
  }
}

// CSRF Protection Missing in Healthcare Forms
class MissingCSRFProtection extends DataFlow::CallNode {
  MissingCSRFProtection() {
    this.getCalleeName() = "fetch" and
    this.getArgument(1).(DataFlow::ObjectLiteralNode).hasPropertyWrite("method", "POST") and
    not exists(DataFlow::ObjectLiteralNode headers |
      this.getArgument(1).(DataFlow::ObjectLiteralNode).hasPropertyWrite("headers", headers) and
      headers.hasPropertyWrite("X-CSRF-Token", _)
    )
  }
}

from HealthcareDataLogging logging
select logging, "Potential PHI data exposure in console logging."

from InsecureLocalStorage storage
select storage, "Insecure storage of healthcare data in localStorage."

from MissingCSRFProtection csrf
select csrf, "Missing CSRF protection in healthcare form submission."