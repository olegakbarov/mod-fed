import { AppTemplate } from '../services/templates';

export const todoAppTemplate: AppTemplate = {
  id: 'todo-app',
  name: 'Todo List Application',
  description: 'A task management application with create, read, update, and delete functionality',
  keywords: ['todo', 'task', 'checklist', 'reminder', 'productivity'],
  aiTags: ['productivity', 'task-management', 'crud'],
  dataCollection: 'todos',
  enableDatabase: true,
  variables: {
    appTitle: 'My Tasks',
    submitLabel: 'Add Task',
    fields: [
      {
        name: 'title',
        label: 'Task',
        type: 'text',
        placeholder: 'Enter task...',
        required: true
      },
      {
        name: 'description',
        label: 'Description',
        type: 'multiline',
        placeholder: 'Task details...',
        required: false
      },
      {
        name: 'priority',
        label: 'Priority',
        type: 'select',
        options: ['Low', 'Medium', 'High'],
        default: 'Medium'
      },
      {
        name: 'dueDate',
        label: 'Due Date',
        type: 'date',
        required: false
      }
    ]
  },
  screens: [
    {
      name: 'MainScreen',
      title: 'Todo List',
      layout: 'vertical',
      components: [
        {
          type: 'Header',
          props: {
            title: '{{appTitle}}'
          },
          order: 1
        },
        {
          type: 'DataForm',
          props: {
            collection: '{{dataCollection}}',
            fields: '{{fields}}',
            submitLabel: '{{submitLabel}}'
          },
          order: 2,
          conditions: {
            requiresDatabase: true
          }
        },
        {
          type: 'DataList',
          props: {
            collection: '{{dataCollection}}',
            onDelete: true,
            onEdit: true,
            sortBy: 'createdAt',
            sortOrder: 'desc'
          },
          order: 3,
          conditions: {
            requiresDatabase: true
          }
        }
      ]
    }
  ],
  metadata: {
    version: '1.0.0',
    author: 'AI Generator',
    category: 'productivity',
    difficulty: 'beginner',
    estimatedTime: '5 minutes'
  }
};