export const errorHandler = (err, req, res, next) => {
  console.error('[API Error]', err.stack || err.message);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errorCode: err.name || 'SERVER_ERROR'
  });
};
