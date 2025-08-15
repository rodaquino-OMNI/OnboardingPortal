/**
 * @name AUSTA PHP Security Analysis
 * @description Healthcare-specific security queries for Laravel backend
 * @kind problem
 * @problem.severity error
 * @precision high
 * @id austa/php-security
 * @tags security healthcare hipaa lgpd
 */

import php

// PHI Data Exposure Detection
class PHIDataFlow extends TaintTracking::Configuration {
  PHIDataFlow() { this = "PHIDataFlow" }

  override predicate isSource(DataFlow::Node source) {
    exists(Variable var |
      var.getName().toLowerCase().matches([
        "%cpf%", "%ssn%", "%social%", "%medical%", 
        "%patient%", "%health%", "%diagnosis%"
      ]) and
      source.asExpr() = var.getAnAccess()
    )
  }

  override predicate isSink(DataFlow::Node sink) {
    exists(Call call |
      call.getTarget().getName().matches([
        "echo", "print", "var_dump", "print_r", "log", "error_log"
      ]) and
      sink.asExpr() = call.getAnArgument()
    )
  }
}

// SQL Injection Detection for Healthcare Data
class HealthcareSQLInjection extends TaintTracking::Configuration {
  HealthcareSQLInjection() { this = "HealthcareSQLInjection" }

  override predicate isSource(DataFlow::Node source) {
    source.asExpr().(Call).getTarget().getName() = ["$_GET", "$_POST", "$_REQUEST"]
  }

  override predicate isSink(DataFlow::Node sink) {
    exists(Call call |
      call.getTarget().getName().matches([
        "mysql_query", "mysqli_query", "pg_query", "DB::raw"
      ]) and
      sink.asExpr() = call.getAnArgument()
    )
  }
}

// Hardcoded Credentials Detection
class HardcodedCredentials extends Expr {
  HardcodedCredentials() {
    exists(StringLiteral str |
      str = this and
      (
        str.getValue().matches(["%password%", "%secret%", "%key%", "%token%"]) or
        str.getValue().matches(["%admin123%", "%root%", "%default%"])
      )
    )
  }
}

from HardcodedCredentials cred
select cred, "Potential hardcoded credential detected in healthcare application."