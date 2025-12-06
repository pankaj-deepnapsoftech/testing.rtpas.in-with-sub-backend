/**
 * Get admin filter for queries
 * For employees, returns their admin's ID so they see their admin's data
 * For admins, returns their own ID
 * For super admins, returns empty filter (sees all)
 * @param {Object} user - The authenticated user object from req.user
 * @returns {Object} - MongoDB filter object
 */
exports.getAdminFilter = (user) => {
  if (user?.isSuper) {
    return {};
  }

  if (user?.admin_id) {
    return { admin_id: user.admin_id };
  }

  return { admin_id: user?._id };
};

/**
 * Get admin ID to set when creating records
 * @param {Object} user - The authenticated user object from req.user
 * @returns {ObjectId|null} - Admin ID to use, or null if super admin
 */
exports.getAdminIdForCreation = (user) => {
  if (user?.isSuper) {
    return user._id;
  }

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
  const fieldToCheck = adminField || record.admin_id ? "admin_id" : "creator";
  const recordAdminId = record[fieldToCheck];
  return recordAdminId && recordAdminId.toString() === user?._id?.toString();
};
