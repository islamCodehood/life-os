import { Card } from '@life-os/design-system';
import type { MotionPreference, VisualizationProfile } from '@/src/domain/identity/experience';
import type { WorldStateDto, MilestoneKey } from '@/src/domain/visual-world/world';
import { groupRecentImpacts } from '@/src/domain/visual-world/world';
import {
  islandManifest,
  islandRegions,
  milestoneRegions,
} from '@/src/domain/visual-world/island-theme';
import type { WorldMessages } from '@/src/i18n/world-messages';

export type IslandWorldProps = {
  state: WorldStateDto;
  messages: WorldMessages;
  visualization: VisualizationProfile;
  motion: MotionPreference;
  themeKey: string;
};

function Scene({ state, messages, motion, themeKey }: IslandWorldProps) {
  const manifest = islandManifest(themeKey);
  const unlocked = new Set(state.unlocks.map((u) => u.semanticKey));
  const glowing = new Set(
    groupRecentImpacts(state.recentImpacts, motion).map((u) => milestoneRegions[u.semanticKey]),
  );
  const active = (key: MilestoneKey) => unlocked.has(key);
  const region = (key: MilestoneKey) =>
    'lo-world__region ' +
    (active(key) ? 'lo-world__region--grown' : 'lo-world__region--waiting') +
    (glowing.has(milestoneRegions[key]) ? ' lo-world__region--recent' : '');
  return (
    <svg
      className="lo-world__art"
      viewBox="0 0 740 468"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      data-theme={manifest.theme}
    >
      <title>{state.scope === 'FAMILY' ? messages.familyTitle : messages.title}</title>
      <desc>{state.unlocks.length ? messages.note : messages.empty}</desc>
      <rect width="740" height="468" rx="26" fill="#dcecef" />
      <path d="M0 330Q125 299 245 331T496 334T740 313V468H0Z" fill="#c0e0e8" />
      <circle cx="643" cy="70" r="28" fill="#f4dc9e" />
      <path
        d="M80 314Q54 264 119 203Q160 166 201 171Q259 108 329 108Q385 62 453 107Q560 84 607 154Q652 205 615 266Q603 328 556 349Q458 395 368 369Q291 411 212 377Q124 394 80 314Z"
        fill="#95bea1"
        stroke="#76a98c"
        strokeWidth="7"
      />
      <path
        d="M121 313Q200 346 252 339T414 347T583 298"
        stroke="#aacaa9"
        strokeWidth="17"
        fill="none"
        strokeLinecap="round"
      />
      <g className={region('HOME_PATH')}>
        <path
          d="M190 264Q245 293 307 266T421 248"
          fill="none"
          stroke={active('HOME_PATH') ? '#f0d6a6' : '#bad1b8'}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={active('HOME_PATH') ? '1 0' : '8 13'}
        />
        <path
          d="M146 233L190 194L230 234V286H150Z"
          fill={active('HOME_PATH') ? '#f1e9d3' : '#c1d4c5'}
          stroke="#668f83"
          strokeWidth="4"
        />
        <path
          d="M136 233L189 183L241 235"
          stroke={active('HOME_PATH') ? '#bf866d' : '#84a399'}
          strokeWidth="11"
          fill="none"
          strokeLinecap="round"
        />
        <rect x="179" y="250" width="23" height="36" rx="5" fill="#789995" />
      </g>
      <g className={region('LIBRARY_OPEN')}>
        <rect
          x="263"
          y="127"
          width="86"
          height="72"
          rx="6"
          fill={active('LIBRARY_OPEN') ? '#f3e6d1' : '#b9cebf'}
          stroke="#799c90"
          strokeWidth="4"
        />
        <path d="M256 134L307 96L357 134Z" fill={active('LIBRARY_OPEN') ? '#bd8474' : '#9ab5a6'} />
        <rect x="282" y="150" width="14" height="34" rx="2" fill="#d9a17a" />
        <rect x="302" y="144" width="12" height="40" rx="2" fill="#84a5b1" />
        <rect x="320" y="150" width="13" height="34" rx="2" fill="#d6bb79" />
      </g>
      <g className={region('BRIDGE_READY')}>
        <path d="M383 257Q412 232 450 252" stroke="#638d92" strokeWidth="18" fill="none" />
        <path
          d="M383 244Q412 208 452 241"
          fill="none"
          stroke={active('BRIDGE_READY') ? '#efd6aa' : '#aec9be'}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path d="M391 235V269M413 224V262M445 233V267" stroke="#729894" strokeWidth="5" />
      </g>
      <g className={region('OBSERVATORY_LIT')}>
        <path d="M513 181L549 112L583 185Z" fill="#85a79d" />
        <rect
          x="525"
          y="123"
          width="58"
          height="58"
          rx="7"
          fill={active('OBSERVATORY_LIT') ? '#e2e8dc' : '#b9cec4'}
          stroke="#699591"
          strokeWidth="4"
        />
        <path d="M526 122Q555 79 583 122Z" fill="#90aeb3" />
        <circle cx="554" cy="149" r="12" fill={active('OBSERVATORY_LIT') ? '#f6df9f' : '#bcd0c8'} />
      </g>
      <g className={region('FAMILY_TREE')}>
        <path d="M514 260V312" stroke="#9d8260" strokeWidth="18" strokeLinecap="round" />
        <circle cx="514" cy="227" r="38" fill={active('FAMILY_TREE') ? '#78a87f' : '#a7c3af'} />
        <circle cx="488" cy="244" r="26" fill={active('FAMILY_TREE') ? '#95bb83' : '#b8cdb5'} />
        <circle cx="544" cy="242" r="29" fill={active('FAMILY_TREE') ? '#73a57c' : '#a8c8b1'} />
      </g>
      <g className={region('GIVING_GARDEN')}>
        <ellipse cx="210" cy="349" rx="64" ry="25" fill="#7eac86" />
        {[172, 197, 222, 248].map((x, i) => (
          <g key={x}>
            <path d={'M' + x + ' 357v-27'} stroke="#598a70" strokeWidth="4" />
            <circle
              cx={x}
              cy={326 + (i % 2) * 7}
              r="11"
              fill={active('GIVING_GARDEN') ? '#ebbb9e' : '#b8cbb5'}
            />
            {active('GIVING_GARDEN') && (
              <circle cx={x} cy={326 + (i % 2) * 7} r="4" fill="#fff0cb" />
            )}
          </g>
        ))}
      </g>
      <g className={region('FAMILY_GARDEN')}>
        <path d="M412 347Q468 367 521 347L500 379H433Z" fill="#759c9a" />
        <path
          d="M462 292V346M466 297L507 327H466Z"
          fill={active('FAMILY_GARDEN') ? '#f4e5bb' : '#b6ccc0'}
          stroke="#739d9b"
          strokeWidth="4"
        />
      </g>
      <g textAnchor="middle" fontSize="14" fontWeight="600" fill="#315f5b">
        {manifest.regions
          .filter((r) => r.region !== 'HOME' && r.region !== 'PATH')
          .map((r) => (
            <text
              key={r.region}
              x={r.cx}
              y={r.cy + (r.region === 'LIBRARY' || r.region === 'OBSERVATORY' ? 82 : 94)}
            >
              {messages[r.labelKey]}
            </text>
          ))}
      </g>
    </svg>
  );
}

export function IslandWorld(props: IslandWorldProps) {
  const { state, messages, visualization, motion } = props;
  const available = new Set(state.unlocks.map((x) => x.semanticKey));
  const title = state.scope === 'FAMILY' ? messages.familyTitle : messages.title;
  const allowedKeys: MilestoneKey[] =
    state.scope === 'FAMILY'
      ? ['FAMILY_TREE', 'FAMILY_GARDEN']
      : ['HOME_PATH', 'BRIDGE_READY', 'LIBRARY_OPEN', 'OBSERVATORY_LIT', 'GIVING_GARDEN'];
  return (
    <Card variant="soft" className="lo-app-foundation__card lo-world">
      <section
        className={'lo-world__layout lo-world__layout--' + visualization.toLowerCase()}
        data-visualization={visualization}
        data-motion={motion}
        aria-label={title}
      >
        <header className="lo-world__heading">
          <h2>{title}</h2>
          <p>{state.scope === 'FAMILY' ? messages.familyIntro : messages.personalIntro}</p>
        </header>
        {visualization !== 'FOCUSED' && <Scene {...props} />}
        <div className="lo-world__details">
          <p className="lo-world__stage">{messages.stage[state.stage - 1] ?? messages.stage[0]}</p>
          {state.unlocks.length === 0 && <p>{messages.empty}</p>}
          <ul className="lo-world__regions">
            {allowedKeys.map((key) => (
              <li
                key={key}
                className={available.has(key) ? 'lo-world__unlocked' : 'lo-world__waiting'}
              >
                <span aria-hidden="true">{available.has(key) ? '✦' : '◌'}</span>
                <span>{messages[key]}</span>
                <span className="lo-world__region-status">
                  {available.has(key) ? messages.unlocked : messages.locked}
                </span>
              </li>
            ))}
          </ul>
          {state.recentImpacts.length > 0 && <p>{messages.recent}</p>}
          <p className="lo-world__note">
            {state.scope === 'FAMILY' ? messages.familyNote : messages.note}
          </p>
          {motion !== 'FULL' && <p className="lo-world__note">{messages.staticView}</p>}
        </div>
      </section>
    </Card>
  );
}
