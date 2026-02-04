import type { Result } from 'axe-core'

/**
 * Log axe violations in a compact, actionable format.
 */
export const logViolations = (violations: Result[]) => {
  const summary = violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    nodes: nodes.length,
  }))

  const formatTarget = (target: Result['nodes'][number]['target']) =>
    Array.isArray(target) ? target.map(String).join(', ') : String(target)

  cy.task(
    'log',
    `${violations.length} accessibility violation${violations.length === 1 ? '' : 's'} detected`
  )
  cy.task('table', summary)

  violations.forEach(({ id, impact, nodes }) => {
    nodes.forEach(({ target, html }) => {
      cy.task(
        'log',
        [
          `Rule: ${id}`,
          `Impact: ${impact ?? 'unknown'}`,
          `Target: ${formatTarget(target)}`,
          `Snippet: ${html}`,
        ].join('\n')
      )
    })
  })
}
