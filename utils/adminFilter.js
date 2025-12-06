/**
 * Get admin filter for queries
 * - Admin (isSuper: true): sees their own data (admin_id = their _id)
 * - Employee (isSuper: false): sees their admin's data (admin_id = their admin_id)
 * @param {Object} user - The authenticated user object from req.user
 * @returns {Object} - MongoDB filter object
 */
exports.getAdminFilter = (user) => {
  if (user?.isSuper) {
    return { admin_id: user._id };
  }

  if (user?.admin_id) {
    return { admin_id: user.admin_id };
  }

  return { admin_id: user?._id };
};

/**
 * Get admin ID to set when creating records
 * - Admin (isSuper: true): uses their own ID
 * - Employee (isSuper: false): uses their admin's ID
 * @param {Object} user - The authenticated user object from req.user
 * @returns {ObjectId} - Admin ID to use for the record
 */
exports.getAdminIdForCreation = (user) => {
  if (user?.admin_id) {
    return user.admin_id;
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
  const fieldToCheck = adminField || (record.admin_id ? "admin_id" : "creator");
  const recordAdminId = record[fieldToCheck];

  const userAdminId = user?.admin_id
    ? user.admin_id.toString()
    : user?._id?.toString();

  return recordAdminId && recordAdminId.toString() === userAdminId;
};
