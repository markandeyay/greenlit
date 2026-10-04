'use client';
import { useState, type ReactNode } from 'react';
import { APP_NAME, COPY } from '@/config/brand';
import { RULES } from '@/config/rules';
import { useSettings, usePrefersReducedMotion } from '@/lib/settings';
import type { ClientSettings } from '@/lib/types';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip, ToggleChip } from '@/components/ui/Chip';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Accent, DisplayHeading } from '@/components/ui/Heading';
import { IconButton } from '@/components/ui/IconButton';
import { IconArrow, IconHelp, IconSettings, IconStats } from '@/components/ui/icons';
import { Panel, Card } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { StatusCell } from '@/components/ui/StatusCell';
import { StatusGlyph } from '@/components/ui/StatusGlyph';
import { Switch } from '@/components/ui/Switch';
import { Tabs } from '@/components/ui/Tabs';
import { Tag } from '@/components/ui/Tag';
import { useToast } from '@/components/ui/Toast';
import { directionWord } from '@/components/ui/status';
import { Breadcrumb } from './Breadcrumb';
import { EndCredits } from './EndCredits';
import { FilmMicrocopy } from './FilmMicrocopy';
import { replayLeader } from './Leader';
import { LeaderStrip } from './LeaderStrip';
import { RecDot } from './RecDot';
import { SceneHeading } from './SceneHeading';
import { SlateMeta } from './SlateMeta';
import { TimecodeClock } from './TimecodeClock';
import { TmdbAttribution } from './TmdbAttribution';

function Block({ n, slug, title, children }: { n: number; slug: string; title: string; children: ReactNode }) {
  return (
    <section className="gl-section" aria-label={title.replace(/\*/g, '')}>
      <SceneHeading n={n} slug={slug} title={title} size="sm" />
      <div className="gl-section__body">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 border-t border-rule py-5 md:grid-cols-[180px_1fr]">
      <p className="ty-label">{label}</p>
      <div className="flex min-w-0 flex-wrap items-start gap-3">{children}</div>
    </div>
  );
}

const MOTION_OPTIONS: ClientSettings['reducedMotion'][] = ['system', 'on', 'off'];

/** /dev/kitchen-sink: every WS4 component and state on one page. */
export function KitchenSink() {
  const [settings, update] = useSettings();
  const reduced = usePrefersReducedMotion();
  const { toast } = useToast();
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sw, setSw] = useState(true);
  const [pressed, setPressed] = useState(false);
  const [flipKey, setFlipKey] = useState(0);

  return (
    <div>
      {/* Controls */}
      <Panel variant="sheet" head={<span>Controls · {APP_NAME} kitchen sink</span>} className="mt-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Switch
            checked={settings.colorblind}
            onChange={(v) => update({ colorblind: v })}
            label="Colorblind mode"
            description="Blue / orange palette plus patterns"
          />
          <fieldset className="grid gap-2">
            <legend className="ty-label">Reduced motion</legend>
            <div className="flex flex-wrap gap-2">
              {MOTION_OPTIONS.map((m) => (
                <ToggleChip key={m} pressed={settings.reducedMotion === m} onClick={() => update({ reducedMotion: m })}>
                  {m}
                </ToggleChip>
              ))}
            </div>
            <p className="text-sm text-ink-dim">Effective: {reduced ? 'reduced' : 'full motion'}</p>
          </fieldset>
          <div className="grid gap-2">
            <Button onClick={() => replayLeader()} icon={<IconArrow />}>
              Replay leader
            </Button>
            <p className="text-sm text-ink-dim">Does nothing while motion is reduced.</p>
          </div>
        </div>
      </Panel>

      <Block n={1} slug="INT. THE TYPE SHOP - DAY" title="Type and *tokens*">
        <Row label="Display + accent">
          <DisplayHeading as="p" size="d1" text="The *Vault*" />
          <DisplayHeading as="p" size="d3" text="Awards *Night*" />
        </Row>
        <Row label="Mono / label / micro">
          <span className="ty-num text-xl">TC 13:42:07:00</span>
          <span className="ty-label">Label text</span>
          <span className="ty-micro text-ink-dim">Micro text</span>
        </Row>
        <Row label="Body">
          <p className="ty-body">
            Body copy in the system grotesk. Everyone gets the same mystery film each day, with {RULES.maxGuesses}{' '}
            takes to find it.
          </p>
        </Row>
        <Row label="Surfaces">
          {['bg', 'surface', 'surface-2', 'rule', 'miss'].map((t) => (
            <span key={t} className="grid gap-1 text-center">
              <span className="block h-12 w-20 border border-rule" style={{ background: `var(--${t})` }} />
              <span className="ty-micro text-ink-dim">--{t}</span>
            </span>
          ))}
        </Row>
      </Block>

      <Block n={2} slug="INT. THE PROP TRUCK - DAY" title="Buttons and *chips*">
        <Row label="Slate (primary)">
          <Button variant="slate" size="sm">
            {COPY.pitchCta}
          </Button>
          <Button variant="slate">{COPY.pitchCta}</Button>
          <Button variant="slate" size="lg" take="TK 04">
            Roll camera
          </Button>
          <Button variant="slate" disabled>
            Disabled
          </Button>
        </Row>
        <Row label="Solid / outline / ghost / danger">
          <Button variant="solid">Post your take</Button>
          <Button>Copy result</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">{COPY.giveUp}</Button>
          <Button disabled>Disabled</Button>
          <ButtonLink href="/how-to-play" variant="outline" size="sm">
            Link button
          </ButtonLink>
        </Row>
        <Row label="Icon buttons">
          <IconButton label="How to play" icon={<IconHelp />} />
          <IconButton label="Stats" icon={<IconStats />} outline />
          <IconButton label="Settings" icon={<IconSettings />} aria-pressed={pressed} onClick={() => setPressed((p) => !p)} />
          <IconButton label="Small" icon={<IconHelp />} size="sm" />
        </Row>
        <Row label="Chips">
          <Chip>Neutral</Chip>
          <Chip status="match">Sci-Fi</Chip>
          <Chip status="miss">Comedy</Chip>
          <Chip cut>Horror</Chip>
          <ToggleChip pressed={pressed} onClick={() => setPressed((p) => !p)}>
            No notes
          </ToggleChip>
        </Row>
        <Row label="Tags">
          <Tag>LEAD</Tag>
          <Tag>SUPP</Tag>
          <Tag tone="solid">US</Tag>
          <Tag tone="dim">PG-13</Tag>
        </Row>
      </Block>

      <Block n={3} slug="INT. THE LAB - NIGHT" title="Status *cells*">
        <Row label="Glyphs">
          <span className="flex items-center gap-2">
            <StatusGlyph verdict="match" /> match
          </span>
          <span className="flex items-center gap-2">
            <StatusGlyph verdict="close" /> close
          </span>
          <span>miss (no glyph)</span>
        </Row>
        <Row label="Numeric">
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4" key={flipKey}>
            <StatusCell animate index={0} verdict="match" label="Year" value="2010" />
            <StatusCell
              animate
              index={1}
              verdict="close"
              label="Year"
              value="2008"
              direction={directionWord('year', 'up', 'close')}
            />
            <StatusCell
              animate
              index={2}
              verdict="miss"
              label="Box office"
              value="$84M"
              direction={directionWord('boxOffice', 'up', 'miss')}
            />
            <StatusCell animate index={3} verdict="na" label="Box office" value="N/A" />
            <StatusCell animate index={4} verdict="close" label="Score" value="81" direction={directionWord('score', 'down', 'close')} />
            <StatusCell animate index={5} verdict="match" label="Rating" value="PG-13" />
            <StatusCell animate index={6} verdict="miss" label="Studio" value="A24" />
            <StatusCell animate index={7} verdict="empty" label="Supp" value="" ariaLabel="Supporting, empty slot." />
          </div>
          <Button size="sm" onClick={() => setFlipKey((k) => k + 1)}>
            Replay flip
          </Button>
        </Row>
        <Row label="Person tiles">
          <div className="grid w-full grid-cols-3 gap-2 sm:grid-cols-6">
            <StatusCell verdict="match" label="Director" value="C. Nolan" />
            <StatusCell verdict="match" label="Lead" value="M. Caine" tag={<Tag>SUPP</Tag>} />
            <StatusCell verdict="miss" label="Supp" value="H. Jackman" />
            <StatusCell verdict="miss" label="Supp" value="S. Johansson" />
            <StatusCell verdict="empty" label="Supp" ariaLabel="Supporting, empty slot." />
            <StatusCell verdict="empty" label="Supp" ariaLabel="Supporting, empty slot." />
          </div>
        </Row>
      </Block>

      <Block n={4} slug="INT. THE OFFICE - DAY" title="Panels and *dialogs*">
        <Row label="Panels">
          <Panel head="Flat panel" foot="Foot · Sc 04" className="w-full sm:w-72">
            Body content.
          </Panel>
          <Card head="Card" className="w-full sm:w-72">
            Raised surface.
          </Card>
          <Panel variant="sheet" head={<span>{COPY.callSheet} · Reel No. 212</span>} className="w-full sm:w-72">
            Call-sheet ruling.
          </Panel>
        </Row>
        <Row label="Dialogs">
          <Button onClick={() => setDialog(true)}>Open dialog</Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            {COPY.giveUp}
          </Button>
          <Dialog
            open={dialog}
            onClose={() => setDialog(false)}
            title={
              <>
                Share your <Accent>take</Accent>
              </>
            }
            description="Spoiler-free. Squares only."
            bar="Sc 05 · Tk 04"
            actions={
              <>
                <Button variant="ghost" onClick={() => setDialog(false)}>
                  Close
                </Button>
                <Button
                  variant="solid"
                  onClick={() => {
                    setDialog(false);
                    toast('Copied to clipboard');
                  }}
                >
                  Copy
                </Button>
              </>
            }
          >
            <p className="ty-num">⬛⬛⬛🟩🟨⬛🟩⬛</p>
          </Dialog>
          <ConfirmDialog
            open={confirm}
            title="Walk away from this reel?"
            description="The answer will be revealed and today's take ends."
            confirmLabel={COPY.giveUp}
            cancelLabel="Keep rolling"
            tone="danger"
            bar="Sc 06 · Tk 07"
            onCancel={() => setConfirm(false)}
            onConfirm={() => {
              setConfirm(false);
              toast(COPY.lossStamp);
            }}
          />
        </Row>
        <Row label="Toast / spinner">
          <Button onClick={() => toast('Copied to clipboard')}>Show toast</Button>
          <Spinner />
          <Spinner label="Loading reel" showLabel />
        </Row>
        <Row label="Tabs">
          <div className="w-full">
            <Tabs
              label="Leaderboard period"
              tabs={[
                { id: 'week', label: 'Weekly', content: <p>Weekly board.</p> },
                { id: 'all', label: 'All time', content: <p>All time board.</p> },
                { id: 'streak', label: 'Streaks', content: <p>Streak board.</p> },
              ]}
            />
          </div>
        </Row>
        <Row label="Switch">
          <Switch checked={sw} onChange={setSw} label="Example switch" description="With a visible state word" />
          <Switch checked={false} onChange={() => {}} label="Disabled" disabled />
        </Row>
      </Block>

      <Block n={5} slug="EXT. THE BACK LOT - NIGHT" title="Film *motifs*">
        <Row label="Timecode">
          <TimecodeClock />
          <TimecodeClock size="lg" />
        </Row>
        <Row label="Slate meta">
          <SlateMeta roll={2026} reel={212} scene={1} take={4} />
        </Row>
        <Row label="Breadcrumb">
          <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: '2026', href: '/vault' }, { label: '212A' }]} />
        </Row>
        <Row label="Microcopy / REC">
          <FilmMicrocopy />
          <span className="flex items-center gap-2 ty-label">
            <RecDot /> REC
          </span>
        </Row>
        <Row label="Scene heading">
          <div className="w-full">
            <SceneHeading n={1} slug="INT. THE CALL SHEET - NIGHT" title="The *Call Sheet*" meta="Everything you have learned" />
          </div>
        </Row>
        <Row label="Leader strips">
          <div className="grid w-full gap-3">
            <LeaderStrip kind="head" />
            <LeaderStrip kind="tail" />
          </div>
        </Row>
        <Row label="End credits">
          <EndCredits
            className="w-full max-w-lg"
            rows={[
              { role: 'Directed by', name: 'You' },
              { role: 'Takes', name: `4 / ${RULES.maxGuesses}` },
            ]}
          />
        </Row>
        <Row label="TMDB">
          <TmdbAttribution className="!mx-0 !items-start text-left" />
        </Row>
      </Block>
    </div>
  );
}
