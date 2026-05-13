export const environment = {
  production: false,

  authServiceBaseUrl: '/api/v1/auth',
  projectServiceBaseUrl: '/api/v1/projects',
  fileServiceBaseUrl: '/api/v1/files',
  collabServiceBaseUrl: '/api/v1/collab',
  collabSocketUrl: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/collab`,
  executionServiceBaseUrl: '/api/v1/executions',
  commentServiceBaseUrl: '/api/v1/comments',
  notificationServiceBaseUrl: '/api/v1/notifications',
  versionServiceBaseUrl: '/api/v1/versions'
};
