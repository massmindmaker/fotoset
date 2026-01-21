/**
 * PinGlass ESLint Plugin - Custom Anti-Pattern Rules
 *
 * Detects project-specific anti-patterns at lint time.
 */

export const rules = {
  /**
   * Disallow references to non-existent user status properties
   */
  'no-user-status': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow references to non-existent user status properties (isPro, is_pro)',
        category: 'Possible Errors',
      },
      messages: {
        noIsPro: 'User status "{{ property }}" does not exist. Use payment status check instead.',
      },
      schema: [],
    },
    create(context) {
      return {
        MemberExpression(node) {
          const property = node.property;
          if (property.type === 'Identifier') {
            const name = property.name;
            if (['isPro', 'is_pro', 'isProUser', 'proStatus'].includes(name)) {
              context.report({
                node,
                messageId: 'noIsPro',
                data: { property: name },
              });
            }
          }
        },
        Literal(node) {
          if (typeof node.value === 'string') {
            if (/is_pro|isPro/i.test(node.value)) {
              // Check if it's in a SQL query context
              const parent = node.parent;
              if (parent?.type === 'TemplateLiteral' || parent?.type === 'TaggedTemplateExpression') {
                context.report({
                  node,
                  messageId: 'noIsPro',
                  data: { property: node.value },
                });
              }
            }
          }
        },
      };
    },
  },

  /**
   * Warn about hardcoded prices
   */
  'no-hardcoded-price': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Warn about hardcoded price values that should come from admin_settings',
        category: 'Best Practices',
      },
      messages: {
        hardcodedPrice: 'Hardcoded price {{ value }}. Use dynamic pricing from admin_settings instead.',
      },
      schema: [],
    },
    create(context) {
      const priceValues = [499, 999, 1499, 1999, 2999];

      return {
        VariableDeclarator(node) {
          if (node.init?.type === 'Literal' && typeof node.init.value === 'number') {
            if (priceValues.includes(node.init.value)) {
              const varName = node.id?.name?.toLowerCase() || '';
              if (varName.includes('price') || varName.includes('amount') || varName.includes('cost')) {
                context.report({
                  node,
                  messageId: 'hardcodedPrice',
                  data: { value: node.init.value },
                });
              }
            }
          }
        },
        Property(node) {
          if (node.value?.type === 'Literal' && typeof node.value.value === 'number') {
            if (priceValues.includes(node.value.value)) {
              const keyName = node.key?.name?.toLowerCase() || node.key?.value?.toLowerCase() || '';
              if (keyName.includes('price') || keyName.includes('amount') || keyName === 'cost') {
                context.report({
                  node,
                  messageId: 'hardcodedPrice',
                  data: { value: node.value.value },
                });
              }
            }
          }
        },
      };
    },
  },

  /**
   * Disallow wrong table names
   */
  'no-wrong-table': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow references to non-existent table names',
        category: 'Possible Errors',
      },
      messages: {
        wrongTable: 'Table "{{ table }}" does not exist. {{ suggestion }}',
      },
      schema: [],
    },
    create(context) {
      const wrongTables = {
        'telegram_queue': 'Use telegram_message_queue instead',
        'user_statuses': 'User statuses do not exist, use payments table',
        'pro_users': 'Pro users table does not exist',
      };

      return {
        TemplateElement(node) {
          const value = node.value?.raw || node.value?.cooked || '';
          for (const [wrongTable, suggestion] of Object.entries(wrongTables)) {
            const regex = new RegExp(`\\b${wrongTable}\\b`, 'gi');
            if (regex.test(value)) {
              context.report({
                node,
                messageId: 'wrongTable',
                data: { table: wrongTable, suggestion },
              });
            }
          }
        },
        Literal(node) {
          if (typeof node.value !== 'string') return;
          for (const [wrongTable, suggestion] of Object.entries(wrongTables)) {
            const regex = new RegExp(`\\b${wrongTable}\\b`, 'gi');
            if (regex.test(node.value)) {
              context.report({
                node,
                messageId: 'wrongTable',
                data: { table: wrongTable, suggestion },
              });
            }
          }
        },
      };
    },
  },

  /**
   * Suggest RETURNING clause for UPDATE statements
   */
  'prefer-returning': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Suggest using RETURNING clause for UPDATE/INSERT for race condition safety',
        category: 'Best Practices',
      },
      messages: {
        missingReturning: 'Consider adding RETURNING clause to detect race conditions.',
      },
      schema: [],
    },
    create(context) {
      return {
        TemplateElement(node) {
          const value = node.value?.raw || node.value?.cooked || '';
          // Check if UPDATE on critical tables without RETURNING
          const criticalTables = ['payments', 'referral_balances', 'generation_jobs'];
          for (const table of criticalTables) {
            const updateRegex = new RegExp(`UPDATE\\s+${table}\\s+SET`, 'i');
            if (updateRegex.test(value) && !/RETURNING/i.test(value)) {
              context.report({
                node,
                messageId: 'missingReturning',
              });
            }
          }
        },
      };
    },
  },
};

export default { rules };
