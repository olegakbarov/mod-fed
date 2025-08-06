import { AppTemplate } from '../services/templates';

export const dashboardAppTemplate: AppTemplate = {
  id: 'dashboard-app',
  name: 'Analytics Dashboard',
  description: 'A data visualization dashboard with charts, metrics, and KPIs',
  keywords: ['dashboard', 'analytics', 'metrics', 'data', 'visualization', 'charts', 'kpi'],
  aiTags: ['analytics', 'visualization', 'monitoring'],
  enableDatabase: false,
  variables: {
    appTitle: 'Analytics Dashboard',
    metrics: [
      {
        id: 'users',
        title: 'Total Users',
        value: '1,234',
        subtitle: 'active users this month',
        icon: 'users',
        trend: '+12%'
      },
      {
        id: 'revenue',
        title: 'Revenue',
        value: '$45,678',
        subtitle: 'this quarter',
        icon: 'dollar',
        trend: '+8%'
      },
      {
        id: 'conversion',
        title: 'Conversion Rate',
        value: '3.2%',
        subtitle: 'from visitors',
        icon: 'chart',
        trend: '-2%'
      },
      {
        id: 'satisfaction',
        title: 'Customer Satisfaction',
        value: '4.8/5',
        subtitle: 'average rating',
        icon: 'star',
        trend: '+0.3'
      }
    ],
    activities: [
      {
        title: 'New user registration',
        timestamp: '2 minutes ago'
      },
      {
        title: 'Order #1234 completed',
        timestamp: '15 minutes ago'
      },
      {
        title: 'Payment received',
        timestamp: '1 hour ago'
      }
    ]
  },
  screens: [
    {
      name: 'DashboardScreen',
      title: 'Dashboard',
      layout: 'grid',
      components: [
        {
          type: 'Header',
          props: {
            title: '{{appTitle}}'
          },
          order: 1
        },
        {
          type: 'MetricsGrid',
          props: {
            metrics: '{{metrics}}',
            columns: 2
          },
          order: 2,
          fallback: {
            type: 'Card',
            repeat: '{{metrics}}',
            props: {
              title: '{{item.title}}',
              content: '{{item.value}} {{item.subtitle}}'
            }
          }
        },
        {
          type: 'List',
          props: {
            title: 'Recent Activity',
            items: '{{activities}}'
          },
          order: 3
        }
      ]
    }
  ],
  metadata: {
    version: '1.0.0',
    author: 'AI Generator',
    category: 'analytics',
    difficulty: 'intermediate',
    estimatedTime: '10 minutes'
  }
};