import { Request, Response, NextFunction } from 'express';
import { checkRequestForPCIData, sanitizePCIData, validateNoPCIData } from '../services/pciCompliance.service';
import { logAudit } from '../utils/auditLogger';
import { logPCIEvent } from '../services/pciMonitoring.service';

/**
 * PCI Compliance Middleware
 * 
 * PURPOSE:
 * - Sanitize PCI-sensitive data from requests before processing
 * - Log attempts to send PCI data
 * - Prevent storage of cardholder data
 * 
 * PCI DSS Requirement 3.4: Render PAN unreadable anywhere it is stored
 * PCI DSS Requirement 8.2: Verify user identity before allowing access
 */

/**
 * Middleware to sanitize PCI-sensitive data from request body, query, and params
 * This ensures no cardholder data is logged or stored
 */
export const pciSanitizeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Check if request contains PCI data
    const pciCheck = checkRequestForPCIData(req);

    if (pciCheck.hasPCIData) {
      // Log security event
      logAudit({
        req,
        action: 'PCI_DATA_DETECTED_IN_REQUEST',
        entityType: 'Security',
        description: `PCI-sensitive data detected in request: ${pciCheck.fields.join(', ')}`,
        metadata: {
          fields: pciCheck.fields,
          path: req.path,
          method: req.method,
        },
      }).catch((err) => {
        console.error('[PCI] Failed to log PCI data detection:', err);
      });

      // Log PCI compliance event
      logPCIEvent({
        req,
        eventType: 'pci_data_detected',
        severity: 'medium',
        description: `PCI-sensitive data detected in request and sanitized`,
        endpoint: req.path,
        method: req.method,
        fields: pciCheck.fields,
        action: 'sanitized',
        metadata: {
          fields: pciCheck.fields,
        },
      }).catch((err) => {
        console.error('[PCI] Failed to log PCI event:', err);
      });

      // Sanitize the request data
      if (req.body) {
        req.body = sanitizePCIData(req.body);
      }
      if (req.query) {
        req.query = sanitizePCIData(req.query) as any;
      }
      if (req.params) {
        req.params = sanitizePCIData(req.params) as any;
      }

      // Continue with sanitized data
      // Note: We don't block the request, but we sanitize it
      // This allows the application to continue while protecting cardholder data
    }

    next();
  } catch (error) {
    console.error('[PCI] Sanitization error:', error);
    next(error);
  }
};

/**
 * Middleware to validate that response does not contain PCI data
 * Throws error if PCI data is detected in response
 */
export const pciValidateResponseMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json.bind(res);

  res.json = function (data: any) {
    try {
      // Validate response does not contain PCI data
      validateNoPCIData(data, 'response');
    } catch (error: any) {
      if (error.isPCIComplianceError) {
        // Log security violation
        logAudit({
          req,
          action: 'PCI_DATA_DETECTED_IN_RESPONSE',
          entityType: 'Security',
          description: 'PCI-sensitive data detected in response. Blocked.',
          metadata: {
            path: req.path,
            method: req.method,
            error: error.message,
          },
        }).catch((err) => {
          console.error('[PCI] Failed to log PCI violation:', err);
        });

        // Log PCI compliance violation
        logPCIEvent({
          req,
          eventType: 'violation',
          severity: 'critical',
          description: 'PCI-sensitive data detected in response. Blocked.',
          endpoint: req.path,
          method: req.method,
          action: 'blocked',
          metadata: {
            error: error.message,
          },
        }).catch((err) => {
          console.error('[PCI] Failed to log PCI violation:', err);
        });

        // Return error instead of PCI data
        return originalJson({
          error: 'Security violation: PCI-sensitive data cannot be returned in response',
        });
      }
      throw error;
    }

    return originalJson(data);
  };

  next();
};

/**
 * Middleware to block requests that contain PCI data
 * Use this for endpoints that should never receive card data
 */
export const pciBlockMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const pciCheck = checkRequestForPCIData(req);

    if (pciCheck.hasPCIData) {
      // Log security violation
      logAudit({
        req,
        action: 'PCI_DATA_BLOCKED',
        entityType: 'Security',
        description: `Request blocked: PCI-sensitive data detected in ${pciCheck.fields.join(', ')}`,
        metadata: {
          fields: pciCheck.fields,
          path: req.path,
          method: req.method,
        },
      }).catch((err) => {
        console.error('[PCI] Failed to log PCI block:', err);
      });

      // Log PCI compliance event
      logPCIEvent({
        req,
        eventType: 'pci_data_blocked',
        severity: 'high',
        description: `Request blocked: PCI-sensitive data detected`,
        endpoint: req.path,
        method: req.method,
        fields: pciCheck.fields,
        action: 'blocked',
        metadata: {
          fields: pciCheck.fields,
        },
      }).catch((err) => {
        console.error('[PCI] Failed to log PCI event:', err);
      });

      res.status(400).json({
        error: 'Cardholder data cannot be sent to this endpoint. Please use a PCI-compliant payment provider.',
        code: 'PCI_COMPLIANCE_VIOLATION',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[PCI] Validation error:', error);
    next(error);
  }
};

