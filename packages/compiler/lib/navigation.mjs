// Navigation menu compilation.
export function buildMenuLinkUrl(item, { routesById, modelsById }) {
  if (item.type === 'page') {
    const route = routesById.get(item.object);
    if (!route) {
      return '#';
    }

    return route.slug ? `/${route.slug}/` : '/';
  }

  if (item.type === 'archive') {
    const model = modelsById.get(item.object);
    if (!model) {
      return '#';
    }

    return model.archiveSlug ? `/${model.archiveSlug}/` : `/${pluralize(model.id)}/`;
  }

  if (item.type === 'url') {
    return item.url ?? '#';
  }

  return '#';
}

export function compileNavigationMarkup(menuItems, { routes, models }) {
  const routesById = new Map(routes.map((route) => [route.id, route]));
  const modelsById = new Map(models.map((model) => [model.id, model]));
  const itemsMarkup = (menuItems ?? [])
    .map((item) => {
      const url = buildMenuLinkUrl(item, { routesById, modelsById });
      const attributes = {
        label: String(item.label ?? ''),
        url,
        isTopLevelLink: true,
      };

      if (item.type === 'page' && item.object) {
        attributes.kind = 'post-type';
        attributes.type = 'page';
        attributes.wpliteTargetKind = 'page';
        attributes.wpliteRouteId = String(item.object);
      } else if (item.type === 'archive' && item.object) {
        attributes.kind = 'custom';
        attributes.type = 'custom';
        attributes.wpliteTargetKind = 'archive';
        attributes.wpliteModelId = String(item.object);
      } else {
        attributes.kind = 'custom';
        attributes.type = 'custom';
      }

      return `\t\t\t\t<!-- wp:navigation-link ${JSON.stringify(attributes)} /-->`;
    })
    .join('\n');

  return `<!-- wp:navigation {"overlayMenu":"mobile","layout":{"type":"flex","justifyContent":"right"}} -->
${itemsMarkup}
<!-- /wp:navigation -->`;
}

export function compileNavigationTemplate(source, menuItems, siteSchema) {
  const navigationMarkup = compileNavigationMarkup(menuItems ?? [], {
    routes: siteSchema.routes ?? [],
    models: siteSchema.models ?? [],
  });

  // Match wp:navigation block comments. The attr JSON allows one level of
  // nesting (e.g. {"layout":{"type":"flex"}}), which a lazy [\s\S]*? would
  // mis-truncate at the first inner `}`.
  const attrs = '(?:\\s+\\{(?:[^{}]|\\{[^{}]*\\})*\\})?';
  const selfClosing = new RegExp(`<!--\\s+wp:navigation${attrs}\\s*\\/-->`, 'g');
  const openClose = new RegExp(
    `<!--\\s+wp:navigation${attrs}\\s*-->[\\s\\S]*?<!--\\s+\\/wp:navigation\\s+-->`,
    'g'
  );

  return source
    .replace(openClose, navigationMarkup)
    .replace(selfClosing, navigationMarkup);
}
