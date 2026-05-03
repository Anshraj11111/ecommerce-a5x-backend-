import Joi from "joi";

// Validation schemas
export const schemas = {
  signup: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required().messages({
      "string.min": "Password must be at least 8 characters long"
    })
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  product: Joi.object({
    id: Joi.string(),
    name: Joi.string().required(),
    price: Joi.number().positive().required(),
    mrp: Joi.number().positive().required(),
    minQty: Joi.number().min(1),
    category: Joi.string().required(),
    sku: Joi.string(),
    rating: Joi.number().min(0).max(5),
    reviewCount: Joi.number().min(0),
    inStock: Joi.boolean(),
    stockCount: Joi.number().min(0),
    shortDescription: Joi.string(),
    features: Joi.array().items(Joi.string()),
    specs: Joi.object(),
    compatibility: Joi.array().items(Joi.string()),
    bulkPricing: Joi.array().items(
      Joi.object({
        min: Joi.number().required(),
        max: Joi.number().required(),
        price: Joi.number().required()
      })
    ),
    badges: Joi.array().items(Joi.string()),
    frequentlyBoughtWith: Joi.array().items(Joi.string()),
    relatedIds: Joi.array().items(Joi.string()),
    imageUrl: Joi.string()
  }),

  kit: Joi.object({
    id: Joi.string(),
    name: Joi.string().required(),
    tier: Joi.string().required(),
    price: Joi.number().positive().required(),
    description: Joi.string().required(),
    includes: Joi.array().items(Joi.string()),
    rating: Joi.number().min(0).max(5),
    imageUrl: Joi.string(),
    videoUrl: Joi.string().allow(''),
    videoDuration: Joi.number().min(0)
  }),

  course: Joi.object({
    id: Joi.string(),
    title: Joi.string().required(),
    description: Joi.string().required(),
    level: Joi.string().valid("BEGINNER", "INTERMEDIATE", "ADVANCED"),
    category: Joi.string(),
    thumbnailUrl: Joi.string(),
    instructor: Joi.string(),
    tags: Joi.array().items(Joi.string()),
    isPublished: Joi.boolean(),
    isFeatured: Joi.boolean(),
    videos: Joi.array(),
    pdfUrl: Joi.string().allow(''),
    pdfName: Joi.string().allow('')
  })
};

// Validation middleware factory
export const validate = (schema) => {
  return (req, res, next) => {
    console.log('Validation middleware - Request body:', req.body);
    
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      console.log('Validation error:', error.details);
      const details = error.details.map(detail => ({
        field: detail.path.join("."),
        message: detail.message
      }));
      return res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details
      });
    }

    console.log('Validation passed, validated data:', value);
    req.validatedData = value;
    next();
  };
};
