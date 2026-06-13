/**
 * Request validation middleware using Joi schemas
 */

'use strict';

const Joi = require('joi');

/**
 * Creates an Express middleware that validates req.body against a Joi schema
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const data = target === 'body' ? req.body : target === 'query' ? req.query : req.params;
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map((d) => ({
          field: d.context?.label || d.path?.join('.'),
          message: d.message.replace(/['"]/g, ''),
        })),
      });
    }

    if (target === 'body') req.body = value;
    else if (target === 'query') req.query = value;
    else req.params = value;

    next();
  };
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const activitySchema = Joi.object({
  category: Joi.string()
    .valid('transport', 'food', 'energy', 'water', 'shopping', 'waste', 'other')
    .required(),
  subtype: Joi.string().max(100).required(),
  value: Joi.number().min(0).max(100000).required(),
  unit: Joi.string().max(20).required(),
  date: Joi.string().isoDate().default(() => new Date().toISOString()),
  notes: Joi.string().max(500).optional().allow(''),
  metadata: Joi.object().optional(),
});

const goalSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  category: Joi.string()
    .valid('transport', 'food', 'energy', 'shopping', 'waste', 'overall')
    .required(),
  targetReduction: Joi.number().min(1).max(100).required(), // percentage
  targetDate: Joi.string().isoDate().required(),
  description: Joi.string().max(500).optional().allow(''),
});

const userProfileSchema = Joi.object({
  displayName: Joi.string().min(2).max(50).optional(),
  location: Joi.string().max(100).optional().allow(''),
  householdSize: Joi.number().integer().min(1).max(20).optional(),
  vehicleType: Joi.string()
    .valid('none', 'electric', 'hybrid', 'petrol', 'diesel', 'motorcycle')
    .optional(),
  dietType: Joi.string()
    .valid('vegan', 'vegetarian', 'pescatarian', 'omnivore', 'keto')
    .optional(),
  energySource: Joi.string()
    .valid('renewable', 'mixed', 'fossil')
    .optional(),
  weeklyFlightHours: Joi.number().min(0).max(100).optional(),
});

module.exports = {
  validate,
  activitySchema,
  goalSchema,
  userProfileSchema,
};
