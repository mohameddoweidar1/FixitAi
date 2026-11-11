export const ok = (res, data = null, message = 'OK', status = 200) =>
  res.status(status).json({
    success: true,
    message,
    data,
  });

export const fail = (res, message = 'Error', status = 500, details = null) =>
  res.status(status).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
