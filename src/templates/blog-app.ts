import { AppTemplate } from '../services/templates';

export const blogAppTemplate: AppTemplate = {
  id: 'blog-app',
  name: 'Blog Application',
  description: 'A content management system for creating and managing blog posts',
  keywords: ['blog', 'article', 'post', 'content', 'writing', 'cms', 'news'],
  aiTags: ['content', 'publishing', 'cms'],
  dataCollection: 'posts',
  enableDatabase: true,
  variables: {
    appTitle: 'My Blog',
    submitLabel: 'Publish Post',
    fields: [
      {
        name: 'title',
        label: 'Title',
        type: 'text',
        placeholder: 'Post title...',
        required: true
      },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: ['Technology', 'Business', 'Lifestyle', 'Travel', 'Other'],
        default: 'Other'
      },
      {
        name: 'content',
        label: 'Content',
        type: 'multiline',
        placeholder: 'Write your post...',
        required: true,
        minLength: 100
      },
      {
        name: 'tags',
        label: 'Tags',
        type: 'tags',
        placeholder: 'Add tags (comma separated)'
      },
      {
        name: 'published',
        label: 'Publish immediately',
        type: 'boolean',
        default: true
      }
    ]
  },
  screens: [
    {
      name: 'BlogScreen',
      title: 'Blog',
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
          type: 'TabNavigator',
          props: {
            tabs: [
              {
                label: 'Write',
                component: 'DataForm',
                props: {
                  collection: '{{dataCollection}}',
                  fields: '{{fields}}',
                  submitLabel: '{{submitLabel}}'
                }
              },
              {
                label: 'Posts',
                component: 'DataList',
                props: {
                  collection: '{{dataCollection}}',
                  onDelete: true,
                  onEdit: true,
                  displayFields: ['title', 'category', 'createdAt']
                }
              }
            ]
          },
          order: 2,
          fallback: [
            {
              type: 'DataForm',
              props: {
                collection: '{{dataCollection}}',
                fields: '{{fields}}',
                submitLabel: '{{submitLabel}}'
              }
            },
            {
              type: 'DataList',
              props: {
                collection: '{{dataCollection}}',
                onDelete: true,
                onEdit: true
              }
            }
          ]
        }
      ]
    }
  ],
  metadata: {
    version: '1.0.0',
    author: 'AI Generator',
    category: 'content',
    difficulty: 'intermediate',
    estimatedTime: '10 minutes'
  }
};