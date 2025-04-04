const passport = require('passport');

// Middleware to authenticate users with JWT
const authenticateJWT = passport.authenticate('jwt', { session: false });

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err) {
      return next(err);
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: req.t('auth:unauthorized')
      });
    }
    
    req.user = user;
    return next();
  })(req, res, next);
};

// Check if the user is the owner of a resource
const isResourceOwner = (resourceModel, resourceIdParam) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const resource = await resourceModel.findById(resourceId);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: req.t('common:notFound')
        });
      }
      
      // Check if the user is the owner
      if (resource.creator_id !== req.user.id && resource.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: req.t('auth:forbidden')
        });
      }
      
      req.resource = resource;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authenticateJWT,
  isAuthenticated,
  isResourceOwner
};