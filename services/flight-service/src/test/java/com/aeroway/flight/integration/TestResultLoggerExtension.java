package com.aeroway.flight.integration;

import org.junit.jupiter.api.extension.AfterTestExecutionCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Emits concise PASS/FAIL lines so Maven output explains which booking behavior was verified.
 */
class TestResultLoggerExtension implements AfterTestExecutionCallback {

    private static final Logger log = LoggerFactory.getLogger(TestResultLoggerExtension.class);

    @Override
    public void afterTestExecution(ExtensionContext context) {
        String name = context.getDisplayName();
        context.getExecutionException().ifPresentOrElse(
                exception -> log.error("FAIL: {} - {}", name, exception.getMessage()),
                () -> log.info("PASS: {}", name)
        );
    }
}
