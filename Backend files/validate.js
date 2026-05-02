import Joi from "joi";

const DEFAULT_OPTIONS = {
  abortEarly: false,
  allowUnknown: false,
  convert: true,
};

const toPlainObject = (value) => {
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value));
};

const formatError = (error) => {
  if (!error) return ["Invalid request"];
  if (Array.isArray(error.details)) {
    return error.details.map((detail) =>
      String(detail.message || "Invalid request").replace(/["]/g, "'"),
    );
  }
  if (error.message) return [error.message];
  return ["Invalid request"];
};

const applyValidated = (target, value) => {
  if (!target || typeof target !== "object") {
    return;
  }
  Object.keys(target).forEach((key) => {
    delete target[key];
  });
  Object.assign(target, value);
};

export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas?.params) {
        const paramsInput =
          req.params && typeof req.params === "object"
            ? toPlainObject(req.params)
            : {};
        const { error, value } = schemas.params.validate(
          paramsInput,
          DEFAULT_OPTIONS,
        );
        if (error) {
          return res.status(400).json({
            message: "Validation error",
            details: formatError(error),
            source: "params",
          });
        }
        applyValidated(req.params, value);
      }

      if (schemas?.query) {
        const queryInput =
          req.query && typeof req.query === "object"
            ? toPlainObject(req.query)
            : {};
        const { error, value } = schemas.query.validate(
          queryInput,
          DEFAULT_OPTIONS,
        );
        if (error) {
          return res.status(400).json({
            message: "Validation error",
            details: formatError(error),
            source: "query",
          });
        }
        applyValidated(req.query, value);
      }

      if (schemas?.body) {
        const { error, value } = schemas.body.validate(
          toPlainObject(req.body),
          DEFAULT_OPTIONS,
        );
        if (error) {
          return res.status(400).json({
            message: "Validation error",
            details: formatError(error),
            source: "body",
          });
        }
        req.body = value;
      }

      return next();
    } catch (err) {
      return res.status(400).json({
        message: "Validation error",
        details: [String(err?.message || "Invalid request")],
        source: "unknown",
      });
    }
  };
}
