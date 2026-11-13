/**
 * Lesson Tree Planner — frontend configuration
 * ---------------------------------------------
 * `apiUrl` is the Apps Script Web App address. It is already filled in, so
 * nobody has to paste it into the sign-in screen.
 *
 * If the backend is ever redeployed, paste the new Web App URL here.
 * It must be the deployment URL that ends in /exec
 * (Apps Script → Deploy → Manage deployments → Web app).
 */
window.PLANNER_CONFIG = {
  appName: 'Lesson Tree Planner',
  schoolName: 'Hithadhoo School',

  apiUrl: 'https://script.google.com/macros/s/AKfycbw0Nt3iwe5FvnvLBrKp2z6ipM9jGQjQVUORLgpBGfcU9zxfcsI4_bIFBoV95F89_hcfMQ/exec',

  // Defaults shown in the settings panel. Users can override them locally.
  defaultTemplateId: '1K7SQsluw4uTnA-3aJX_5ezPD5FdfuSM12ezAZMiSSTg',
  defaultFolderId: '1nzJEQFBS1uV-67mn-KtQJ-d4fZKpVp3A'
};
