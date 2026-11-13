/**
 * Lesson Tree Planner — frontend configuration
 * ---------------------------------------------
 * Set `apiUrl` to your Apps Script Web App URL (it ends in /exec).
 *
 * Apps Script editor → Deploy → Manage deployments
 *   • Type: Web app
 *   • Execute as: Me
 *   • Who has access: Anyone
 *   • Copy the "Web app" URL and paste it below (or paste it in the
 *     sign-in screen → "Connection").
 */
window.PLANNER_CONFIG = {
  appName: 'Lesson Tree Planner',
  schoolName: 'Hithadhoo School',

  // Example: 'https://script.google.com/macros/s/AKfycb.../exec'
  apiUrl: '',

  // Defaults shown in the settings panel. Users can override them locally.
  defaultTemplateId: '1K7SQsluw4uTnA-3aJX_5ezPD5FdfuSM12ezAZMiSSTg',
  defaultFolderId: '1nzJEQFBS1uV-67mn-KtQJ-d4fZKpVp3A'
};
