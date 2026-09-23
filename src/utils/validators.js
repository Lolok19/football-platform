function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function validatePassword(password) {
  const value = String(password || '');
  return value.length >= 8 && /[^A-Za-zА-Яа-я0-9\s]/.test(value);
}

module.exports = { validateEmail, validatePassword };
