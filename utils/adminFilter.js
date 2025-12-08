/**
 * Get admin filter for queries
 * - Admin (isSuper: true): sees their own data (admin_id = their _id)
 * - Employee (isSuper: false): sees their admin's data (admin_id = their admin_id)
 * @param {Object} user - The authenticated user object from req.user
 * @returns {Object} - MongoDB filter object
 */
exports.getAdminFilter = (user) => {
  let adminId;
  
  if (user?.isSuper) {
    adminId = user._id;
  } else if (user?.admin_id) {
    adminId = user.admin_id;
  } else {
    adminId = user?._id;
  }

  // Return filter that matches admin_id and ensures it's not null
  // This prevents old records without admin_id or with null admin_id from showing up
  return { 
    $and: [
      { admin_id: adminId },
      { admin_id: { $ne: null } }
    ]
  };
};

/**
 * Get admin ID to set when creating records
 * - Admin (isSuper: true): uses their own ID
 * - Employee (isSuper: false): uses their admin's ID
 * @param {Object} user - The authenticated user object from req.user
 * @returns {ObjectId} - Admin ID to use for the record
 */
exports.getAdminIdForCreation = (user) => {
  if (!user || !user._id) {
    throw new Error("User ID is required to set admin_id");
  }

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

/**
 * Clean update data to prevent admin_id from being set to null/undefined
 * @param {Object} updateData - The update data object
 * @returns {Object} - Cleaned update data without admin_id if it's null/undefined
 */
exports.cleanUpdateData = (updateData) => {
  const cleaned = { ...updateData };
  // Remove admin_id if it's null or undefined to preserve existing value
  if (cleaned.admin_id === null || cleaned.admin_id === undefined) {
    delete cleaned.admin_id;
  }
  return cleaned;
};
