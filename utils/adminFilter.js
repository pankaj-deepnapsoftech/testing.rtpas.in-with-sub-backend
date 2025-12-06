/**
 * Utility functions for admin data filtering
 * Ensures each admin only sees their own data unless they are a super admin
 */

/**
 * Get admin filter for queries
 * @param {Object} user - The authenticated user object from req.user
 * @returns {Object} - MongoDB filter object
 */
exports.getAdminFilter = (user) => {
  // If user is super admin, return empty filter (can see all data)
  // Note: You might want to add a check here if there's a distinction between
  // super admin and regular admin. For now, we'll use isSuper flag.
  
  // If user is not super admin, filter by their admin_id
  // We'll use creator field or admin_id field depending on the model
  if (user?.isSuper) {
    // Super admin can see all data - return empty filter
    return {};
  }
  
  // Regular admin or employee - only see their own data
  // Return filter by admin_id (which should be set to user._id for admins)
  return { admin_id: user._id };
};

/**
 * Get admin ID to set when creating records
 * @param {Object} user - The authenticated user object from req.user
 * @returns {ObjectId|null} - Admin ID to use, or null if super admin
 */
exports.getAdminIdForCreation = (user) => {
  // If user is super admin, they might not need admin_id
  // But for consistency, we'll still set it
  if (user?.isSuper) {
    return user._id; // Set admin_id to the super admin's ID
  }
  
  // For regular admins and employees, set admin_id to their admin's ID
  // If employee belongs to an admin, we might need to track that separately
  // For now, we'll use the user's ID
  return user._id;
};

/**
 * Check if user can access a specific record
 * @param {Object} user - The authenticated user object
 * @param {Object} record - The record to check access for
 * @param {String} adminField - The field name that stores admin_id (default: 'admin_id' or 'creator')
 * @returns {Boolean} - True if user can access the record
 */
exports.canAccessRecord = (user, record, adminField = null) => {
  // Super admin can access everything
  if (user?.isSuper) {
    return true;
  }
  
  // Determine which field to check
  const fieldToCheck = adminField || record.admin_id ? 'admin_id' : 'creator';
  const recordAdminId = record[fieldToCheck];
  
  // User can access if the record belongs to them
  return recordAdminId && recordAdminId.toString() === user._id.toString();
};

