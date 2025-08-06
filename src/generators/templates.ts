/**
 * App Templates for AI Generator
 * Simple, maintainable template definitions
 */

export interface AppSpec {
  appName: string;
  screens: Array<{
    name: string;
    components: Array<{
      type: string;
      props: Record<string, any>;
    }>;
  }>;
  dataCollection?: string;
  enableDatabase?: boolean;
}

export interface Template {
  name: string;
  keywords: string[];
  generate: () => AppSpec;
}

export const todoTemplate: Template = {
  name: 'Todo List App',
  keywords: ['todo', 'task', 'list', 'checklist'],
  generate: () => ({
    appName: 'Todo List App',
    dataCollection: 'todos',
    enableDatabase: true,
    screens: [{
      name: 'MainScreen',
      components: [
        {
          type: 'Header',
          props: { title: 'My Tasks' }
        },
        {
          type: 'DataForm',
          props: { 
            collection: 'todos',
            fields: [
              { name: 'title', label: 'Task', placeholder: 'Enter task...' },
              { name: 'description', label: 'Description', type: 'multiline', placeholder: 'Task details...' }
            ],
            submitLabel: 'Add Task'
          }
        },
        {
          type: 'DataList',
          props: {
            collection: 'todos',
            onDelete: true
          }
        }
      ]
    }]
  })
};

export const dashboardTemplate: Template = {
  name: 'Dashboard App',
  keywords: ['dashboard', 'analytics', 'metrics', 'charts'],
  generate: () => ({
    appName: 'Dashboard App',
    screens: [{
      name: 'DashboardScreen',
      components: [
        {
          type: 'Header',
          props: { title: 'Analytics Dashboard' }
        },
        {
          type: 'Card',
          props: {
            title: 'Total Users',
            content: '1,234 active users this month'
          }
        },
        {
          type: 'Card',
          props: {
            title: 'Revenue',
            content: '$45,678 this quarter'
          }
        },
        {
          type: 'List',
          props: {
            items: [
              { title: 'Recent Activity 1' },
              { title: 'Recent Activity 2' },
              { title: 'Recent Activity 3' }
            ]
          }
        }
      ]
    }]
  })
};

export const blogTemplate: Template = {
  name: 'Blog App',
  keywords: ['blog', 'article', 'post', 'content', 'writing'],
  generate: () => ({
    appName: 'Blog App',
    dataCollection: 'posts',
    enableDatabase: true,
    screens: [{
      name: 'BlogScreen',
      components: [
        {
          type: 'Header',
          props: { title: 'My Blog' }
        },
        {
          type: 'DataForm',
          props: {
            collection: 'posts',
            fields: [
              { name: 'title', label: 'Title', placeholder: 'Post title...' },
              { name: 'content', label: 'Content', type: 'multiline', placeholder: 'Write your post...' }
            ],
            submitLabel: 'Publish Post'
          }
        },
        {
          type: 'DataList',
          props: {
            collection: 'posts',
            onDelete: true
          }
        }
      ]
    }]
  })
};

// All built-in templates
export const templates: Template[] = [
  todoTemplate,
  dashboardTemplate,
  blogTemplate
];