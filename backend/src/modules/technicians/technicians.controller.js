import {
  createProfileSchema, updateProfileSchema, filterSchema, idParamSchema,
  addSpecializationSchema, setWorkDaysSchema,
  addTimeSlotSchema, updateTimeSlotSchema, slotIdParamSchema,
  galleryIdParamSchema,
} from './technicians.schema.js';
import {
  listProfiles, adminListProfiles, getProfileById, createProfileForUser, updateProfileById, toggleVerification,
  addSpecialization, removeSpecialization, listSpecializations,
  setWorkDays, listWorkDays, addTimeSlot, updateTimeSlot, deleteTimeSlot, listTimeSlots,
  addGalleryImage, removeGalleryImage, listGallery,
  getAllCategories, getOwnProfile, getAvailableCities,
} from './technicians.service.js';
import { ok, fail } from '../../utils/apiResponse.js';

// ── Categories ────────────────────────────────────────────
export async function listCategories(req, res, next) {
  try { return ok(res, { categories: await getAllCategories() }, 'Categories'); }
  catch (err) { return next(err); }
}

export async function listCities(req, res, next) {
  try { return ok(res, { cities: await getAvailableCities() }, 'Cities'); }
  catch (err) { return next(err); }
}

// ── Profiles ──────────────────────────────────────────────
export async function list(req, res, next) {
  try { const f = filterSchema.parse(req.query); return ok(res, await listProfiles(f), 'Technicians'); }
  catch (err) { return next(err); }
}

export async function adminList(req, res, next) {
  try {
    const filters = {
      search: req.query.search || undefined,
      isVerified: req.query.isVerified === 'true' ? true : req.query.isVerified === 'false' ? false : undefined,
      isAvailable: req.query.isAvailable === 'true' ? true : req.query.isAvailable === 'false' ? false : undefined,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    return ok(res, await adminListProfiles(filters), 'All technicians');
  } catch (err) { return next(err); }
}

export async function getById(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const profile = await getProfileById(id);
    if (!profile) return fail(res, 'Technician profile not found', 404);
    return ok(res, { profile }, 'Technician');
  } catch (err) { return next(err); }
}

export async function getMe(req, res, next) {
  try {
    const profile = await getOwnProfile(req.user.id);
    if (!profile) return fail(res, 'Technician profile not found', 404);
    return ok(res, { profile }, 'Your Technician Profile');
  } catch (err) { return next(err); }
}

export async function create(req, res, next) {
  try { const data = createProfileSchema.parse(req.body); return ok(res, { profile: await createProfileForUser(req.user.id, data) }, 'Technician profile created', 201); }
  catch (err) { return next(err); }
}

export async function update(req, res, next) {
  try { const { id } = idParamSchema.parse(req.params); const data = updateProfileSchema.parse(req.body); return ok(res, { profile: await updateProfileById(id, req.user.id, data) }, 'Technician profile updated'); }
  catch (err) { return next(err); }
}

export async function verify(req, res, next) {
  try { const { id } = idParamSchema.parse(req.params); return ok(res, { profile: await toggleVerification(id) }, 'Technician verification toggled'); }
  catch (err) { return next(err); }
}

// ── Specializations ───────────────────────────────────────
export async function addSpec(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { categoryId } = addSpecializationSchema.parse(req.body);
    // Verify ownership
    const profile = await getProfileById(id);
    if (!profile) return fail(res, 'Profile not found', 404);
    if (profile.userId !== req.user.id) return fail(res, 'You can only manage your own profile', 403);
    return ok(res, { specializations: await addSpecialization(id, categoryId) }, 'Specialization added', 201);
  } catch (err) { return next(err); }
}

export async function removeSpec(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const categoryId = req.params.categoryId;
    const profile = await getProfileById(id);
    if (!profile) return fail(res, 'Profile not found', 404);
    if (profile.userId !== req.user.id) return fail(res, 'You can only manage your own profile', 403);
    return ok(res, { specializations: await removeSpecialization(id, categoryId) }, 'Specialization removed');
  } catch (err) { return next(err); }
}

export async function getSpecs(req, res, next) {
  try { const { id } = idParamSchema.parse(req.params); return ok(res, { specializations: await listSpecializations(id) }, 'Specializations'); }
  catch (err) { return next(err); }
}

// ── Schedule (Work Days + Time Slots) ─────────────────────
export async function setSchedule(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const profile = await getProfileById(id);
    if (!profile) return fail(res, 'Profile not found', 404);
    if (profile.userId !== req.user.id) return fail(res, 'You can only manage your own profile', 403);
    const { days } = setWorkDaysSchema.parse(req.body);
    return ok(res, { workDays: await setWorkDays(id, days) }, 'Work days updated');
  } catch (err) { return next(err); }
}

export async function getSchedule(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const [workDays, timeSlots] = await Promise.all([listWorkDays(id), listTimeSlots(id)]);
    return ok(res, { workDays, timeSlots }, 'Schedule');
  } catch (err) { return next(err); }
}

export async function addSlot(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const profile = await getProfileById(id);
    if (!profile) return fail(res, 'Profile not found', 404);
    if (profile.userId !== req.user.id) return fail(res, 'You can only manage your own profile', 403);
    const data = addTimeSlotSchema.parse(req.body);
    return ok(res, { slot: await addTimeSlot(id, data) }, 'Time slot added', 201);
  } catch (err) { return next(err); }
}

export async function updateSlot(req, res, next) {
  try {
    const { id, slotId } = slotIdParamSchema.parse(req.params);
    const profile = await getProfileById(id);
    if (!profile) return fail(res, 'Profile not found', 404);
    if (profile.userId !== req.user.id) return fail(res, 'You can only manage your own profile', 403);
    const data = updateTimeSlotSchema.parse(req.body);
    return ok(res, { slot: await updateTimeSlot(slotId, id, data) }, 'Time slot updated');
  } catch (err) { return next(err); }
}

export async function removeSlot(req, res, next) {
  try {
    const { id, slotId } = slotIdParamSchema.parse(req.params);
    const profile = await getProfileById(id);
    if (!profile) return fail(res, 'Profile not found', 404);
    if (profile.userId !== req.user.id) return fail(res, 'You can only manage your own profile', 403);
    await deleteTimeSlot(slotId, id);
    return ok(res, null, 'Time slot removed');
  } catch (err) { return next(err); }
}

// ── Gallery ───────────────────────────────────────────────
export async function addImage(req, res, next) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const profile = await getProfileById(id);
    if (!profile) return fail(res, 'Profile not found', 404);
    if (profile.userId !== req.user.id) return fail(res, 'You can only manage your own profile', 403);
    // Support both file upload (multipart) and JSON body (imageUrl)
    let imageUrl;
    if (req.uploadedFile) {
      imageUrl = req.uploadedFile.url;
    } else if (req.body?.imageUrl) {
      imageUrl = req.body.imageUrl;
    } else {
      return fail(res, 'No image file or imageUrl provided', 400);
    }
    const caption = req.body?.caption || '';
    const displayOrder = parseInt(req.body?.displayOrder) || 0;
    return ok(res, { image: await addGalleryImage(id, { imageUrl, caption, displayOrder }) }, 'Gallery image added', 201);
  } catch (err) { return next(err); }
}

export async function removeImage(req, res, next) {
  try {
    const { id, imageId } = galleryIdParamSchema.parse(req.params);
    const profile = await getProfileById(id);
    if (!profile) return fail(res, 'Profile not found', 404);
    if (profile.userId !== req.user.id) return fail(res, 'You can only manage your own profile', 403);
    await removeGalleryImage(imageId, id);
    return ok(res, null, 'Gallery image removed');
  } catch (err) { return next(err); }
}

export async function getImages(req, res, next) {
  try { const { id } = idParamSchema.parse(req.params); return ok(res, { images: await listGallery(id) }, 'Gallery'); }
  catch (err) { return next(err); }
}
