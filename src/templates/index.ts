import { AppTemplate } from '../services/templates';
import { todoAppTemplate } from './todo-app';
import { dashboardAppTemplate } from './dashboard-app';
import { blogAppTemplate } from './blog-app';
import { genericAppTemplate } from './generic-app';

export const allTemplates: AppTemplate[] = [
  todoAppTemplate,
  dashboardAppTemplate,
  blogAppTemplate,
  genericAppTemplate
];

export const templateMap: Map<string, AppTemplate> = new Map(
  allTemplates.map(template => [template.id, template])
);

export {
  todoAppTemplate,
  dashboardAppTemplate,
  blogAppTemplate,
  genericAppTemplate
};