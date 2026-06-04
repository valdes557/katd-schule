/**
 * Escape special regex characters from user input to prevent ReDoS attacks.
 */
function escapeRegex(str) {
  if (!str || typeof str !== 'string') return ''
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = { escapeRegex }
