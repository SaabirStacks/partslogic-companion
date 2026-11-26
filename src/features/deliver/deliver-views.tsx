import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Linking, View } from 'react-native';

import { unbroken } from '@/lib/format';
import { ActionBar, BottomBar } from '@/ui/action-bar';
import { Button } from '@/ui/button';
import { Choice } from '@/ui/choice';
import { Field } from '@/ui/field';
import { Icon } from '@/ui/icon';
import { JobBanner } from '@/ui/job-banner';
import { Notice } from '@/ui/notice';
import { ReceiptCard } from '@/ui/receipt';
import { Scroll } from '@/ui/scroll';
import { SectionLabel } from '@/ui/section-label';
import { Sheet } from '@/ui/sheet';
import { StatusStrip } from '@/ui/status-strip';
import { PressableCard } from '@/ui/surface';
import { Txt } from '@/ui/text';
import {
  CALL_CUSTOMER,
  CLEAR_SIGNATURE,
  DELIVERED,
  deliveryAddressLines,
  deliveryLineWords,
  deliveryRowLine,
  deliverySections,
  deliverySentWords,
  GET_SIGNATURE,
  NEXT_DELIVERY,
  NOT_RECORDED,
  NOTHING_OUT,
  outFromWords,
  RECEIVED_STATEMENT,
  RING_THE_OFFICE,
  SENDS_WHEN_ONLINE,
  SIGN_HERE,
  SIGNED_NAME_LABEL,
  SIGNED_NAME_MAX,
  signedReceiptWords,
  signLine,
  signTitle,
  WAITING_FOR_SIGNAL,
  WITH_YOU,
  type DriverDelivery,
} from '@/vendor/partslogic/shared/sales/delivery';
import {
  NOT_DELIVERED,
  NOT_DELIVERED_LINE,
  NOT_DELIVERED_NOTE_MAX,
  NOT_DELIVERED_REASON_LABELS,
  NOT_DELIVERED_REASONS,
  notDeliveredTitle,
  type NotDeliveredReason,
} from '@/vendor/partslogic/shared/sales/handover';
import { quantityWords } from '@/vendor/partslogic/shared/sales/words';

import { SignaturePad } from './signature-pad';
import type { DeliverState, Signing, SigningProblem } from './use-deliver';
import { CHECKING, DELIVER_OFFLINE, deliveryCustomer, NO_SIGNAL_LIST } from './words';

// The deliveries out from the branch, the driver's own under With you first, then the rest of the branch's as
// PartsLogic lists them. A row: "Northway Fleet Services", "Shipley BD18 · 2 parcels", "SO-000015 · sent 09:12".
export function DeliverList({
  list,
  onOpen,
}: {
  list: Pick<DeliverState['list'], 'online' | 'location' | 'now' | 'deliveries' | 'saved' | 'problem' | 'reload'>;
  onOpen: (delivery: DriverDelivery) => void;
}) {
  if (!list.deliveries) {
    if (!list.online) return <Notice icon="offline" tone="warn" title={NO_SIGNAL_LIST.title} line={NO_SIGNAL_LIST.line} />;
    return (
      <Notice icon="deliver" tone={list.problem ? 'stop' : 'neutral'} title={list.problem ? 'Not checked' : CHECKING} line={list.problem}>
        {list.problem ? <Button label="Try again" icon="retry" variant="tinted" onPress={list.reload} /> : null}
      </Notice>
    );
  }
  if (list.deliveries.length === 0) return <Notice icon="sent" tone="neutral" title={NOTHING_OUT.title} line={NOTHING_OUT.description} />;
  const { mine, others } = deliverySections(list.deliveries);
  return (
    <Scroll toEdge contentContainerClassName="gap-2 px-4 pt-3" onRefresh={list.online ? list.reload : undefined}>
      {!list.online ? <StatusStrip tone="neutral" icon="offline" text={DELIVER_OFFLINE} /> : null}
      {mine.length > 0 ? <SectionLabel family="outbound">{WITH_YOU}</SectionLabel> : null}
      {mine.map((delivery) => (
        <DeliveryRow key={delivery.orderId} delivery={delivery} now={list.now} onPress={() => onOpen(delivery)} />
      ))}
      {others.length > 0 ? <SectionLabel>{outFromWords(list.location)}</SectionLabel> : null}
      {others.map((delivery) => (
        <DeliveryRow key={delivery.orderId} delivery={delivery} now={list.now} onPress={() => onOpen(delivery)} />
      ))}
    </Scroll>
  );
}

function DeliveryRow({ delivery, now, onPress }: { delivery: DriverDelivery; now: string; onPress: () => void }) {
  const place = deliveryRowLine(delivery);
  // the branch's deliveries say whose van they're in (critique A)
  const sent = [deliverySentWords(delivery, now), !delivery.mine ? delivery.driver : null].filter(Boolean).join(' · ');
  return (
    <PressableCard accessibilityLabel={`${deliveryCustomer(delivery)}, ${place}, ${sent}`} onPress={onPress} className="min-h-16 flex-row items-center gap-3 px-4 py-3">
      <View className="flex-1 gap-0.5">
        <Txt variant="label" className="font-bold">
          {deliveryCustomer(delivery)}
        </Txt>
        <Txt variant="caption" numbers>
          {place}
        </Txt>
        <Txt variant="caption" ink="text-quiet-ink">
          {unbroken(sent)}
        </Txt>
      </View>
      <Icon name="forward" size={16} colour="quiet-ink" />
    </PressableCard>
  );
}

// At the door: the order and who it's for, the address, Call, what's in the van for it, then Get signature in the
// thumb zone and Not delivered beside it. Drawn from its props, so the review gallery shows it from fixtures.
export function DropView({
  delivery,
  online,
  onSign,
  onNotDelivered,
  onClose,
}: {
  delivery: DriverDelivery;
  online: boolean;
  onSign: () => void;
  onNotDelivered: () => void;
  onClose: () => void;
}) {
  const address = deliveryAddressLines(delivery);
  return (
    <View className="flex-1 bg-ground">
      <JobBanner size="headline" family="outbound" title={delivery.order} detail={deliveryCustomer(delivery)} />
      <Scroll toEdge={false} contentContainerClassName="gap-3 px-4 pt-3">
        {!online ? <StatusStrip tone="neutral" icon="offline" text={DELIVER_OFFLINE} /> : null}
        <View accessible className="gap-0.5 rounded-card bg-surface px-4 py-3">
          {address.length > 0 ? (
            address.map((line, at) => (
              <Txt key={at} variant={at === 0 ? 'label' : 'body'} className={at === 0 ? 'font-bold' : undefined}>
                {line}
              </Txt>
            ))
          ) : (
            <Txt variant="body" ink="text-quiet-ink">
              No address on the order
            </Txt>
          )}
        </View>
        {delivery.phone ? (
          <Button label={CALL_CUSTOMER} icon="call" variant="tinted" onPress={() => void Linking.openURL(`tel:${delivery.phone!.replace(/\s+/g, '')}`)} />
        ) : null}
        <SectionLabel>{signLine(delivery)}</SectionLabel>
        {delivery.lines.map((line) => (
          <View key={line.lineId} className="gap-0.5 rounded-card bg-surface px-4 py-3">
            <Txt variant="label" className="font-bold">
              {deliveryLineWords(line)}
            </Txt>
            {line.part.description ? (
              <Txt variant="caption" numberOfLines={2}>
                {line.part.description}
              </Txt>
            ) : null}
          </View>
        ))}
        <Button label="Another delivery" icon="back" variant="secondary" onPress={onClose} />
      </Scroll>
      <BottomBar className="gap-2">
        <Button label={GET_SIGNATURE} icon="deliver" onPress={onSign} />
        <Button label={NOT_DELIVERED} variant="tinted" onPress={onNotDelivered} />
      </BottomBar>
    </View>
  );
}

// Sign for SO-000015: the name of the person signing, then the pad, Clear, and Delivered, which says what is still
// missing (the name first) instead of sending (D3). The screen holds still while a finger is on the pad.
export function SignView({
  delivery,
  signing,
  problem,
  onName,
  onDraw,
  onClear,
  onDelivered,
  onBack,
}: {
  delivery: DriverDelivery;
  signing: Signing;
  problem: SigningProblem;
  onName: (name: string) => void;
  onDraw: (change: (now: Signing['strokes']) => Signing['strokes'], size: Signing['size']) => void;
  onClear: () => void;
  onDelivered: () => void;
  onBack: () => void;
}) {
  const [drawing, setDrawing] = useState(false);
  return (
    <View className="flex-1 bg-ground">
      <JobBanner size="headline" family="outbound" title={signTitle(delivery.order)} detail={signLine(delivery)} />
      <Scroll toEdge={false} scrollEnabled={!drawing} contentContainerClassName="gap-3 px-4 pt-3">
        {/* What the customer agrees to: it's what the note prints over the signature (owner, 26 November 2026). */}
        <View accessible className="gap-0.5">
          <Txt variant="label" className="font-bold">
            {deliveryCustomer(delivery)}
          </Txt>
          <Txt variant="body">{RECEIVED_STATEMENT}</Txt>
        </View>
        <Field
          label={SIGNED_NAME_LABEL}
          value={signing.name}
          onChangeText={onName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="done"
          maxLength={SIGNED_NAME_MAX}
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {problem?.field === 'name' ? <StatusStrip tone="stop" icon="stop" text={problem.message} /> : null}
        <SignaturePad strokes={signing.strokes} hint={SIGN_HERE} onDraw={onDraw} onDrawing={setDrawing} />
        <View className="flex-row justify-end">
          <Button label={CLEAR_SIGNATURE} icon="undo" variant="secondary" compact disabled={signing.strokes.length === 0} onPress={onClear} />
        </View>
        {problem?.field === 'signature' ? <StatusStrip tone="stop" icon="stop" text={problem.message} /> : null}
      </Scroll>
      <ActionBar label={DELIVERED} icon="check" onPress={onDelivered} secondary={{ label: 'Back', icon: 'back', onPress: onBack }} />
    </View>
  );
}

// Not delivered · SO-000015: why, as the web asks it (Other needs a note); the parts come back to the shelf.
export function NotDeliveredSheet({
  order,
  visible,
  onSave,
  onClose,
}: {
  order: string;
  visible: boolean;
  // Saves it, or answers what is wrong with it.
  onSave: (reason: NotDeliveredReason | null, note: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<NotDeliveredReason | null>(null);
  const [note, setNote] = useState('');
  const [wrong, setWrong] = useState<string | null>(null);
  return (
    <Sheet visible={visible} title={notDeliveredTitle(unbroken(order))} onClose={onClose} keyboard={reason === 'other'}>
      <Txt variant="caption">{NOT_DELIVERED_LINE}</Txt>
      <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Why?">
        {NOT_DELIVERED_REASONS.map((value) => (
          <Choice
            key={value}
            pick="reason"
            title={NOT_DELIVERED_REASON_LABELS[value]}
            selected={reason === value}
            onPress={() => {
              setReason(value);
              setWrong(null);
            }}
          />
        ))}
      </View>
      {reason === 'other' ? <Field label="Note" value={note} onChangeText={setNote} maxLength={NOT_DELIVERED_NOTE_MAX} returnKeyType="done" /> : null}
      {wrong ? <StatusStrip tone="stop" icon="stop" text={wrong} /> : null}
      <View className="gap-2">
        {/* Blue, not red: the parts come back and the order can go out again; nothing is lost (DESIGN.md, red only blocks). */}
        <Button label={NOT_DELIVERED} onPress={() => void onSave(reason, note).then(setWrong)} />
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </Sheet>
  );
}

// After Delivered or Not delivered: the order and what was said, the chip sweeping to Delivered once PartsLogic has it,
// Waiting for signal until then (D6), or PartsLogic's reason when it refused (D4).
export function DeliverReceipt({ handed, now, onNext, onDone }: { handed: NonNullable<DeliverState['handed']>; now: string; onNext: () => void; onDone: () => void }) {
  const delivered = handed.kind === 'delivered';
  const chip =
    handed.state === 'refused'
      ? ({ tone: 'stop', icon: 'stop', label: NOT_RECORDED } as const)
      : handed.state === 'waiting'
        ? ({ tone: 'neutral', icon: 'offline', label: WAITING_FOR_SIGNAL } as const)
        : handed.state === 'sending'
          ? ({ tone: 'neutral', icon: 'waiting', label: 'Sending' } as const)
          : delivered
            ? ({ tone: 'ok', icon: 'sent', label: DELIVERED } as const)
            : ({ tone: 'warn', icon: 'warning', label: NOT_DELIVERED } as const);
  const units = handed.delivery.units;
  // The chip sweeping to Delivered (or Not recorded) is said, not only shown (critique B).
  const said = useRef(chip.label);
  useEffect(() => {
    if (said.current === chip.label) return;
    said.current = chip.label;
    AccessibilityInfo.announceForAccessibility(`${handed.delivery.order}: ${chip.label}`);
  }, [chip.label, handed.delivery.order]);
  return (
    <View className="flex-1 bg-ground">
      <Scroll toEdge={false} contentContainerClassName="flex-grow justify-center gap-3 px-4 pt-6">
        <ReceiptCard
          chip={chip}
          reference={handed.delivery.order}
          line={handed.kind === 'delivered' ? signedReceiptWords(handed.name, handed.signedAt, now) : NOT_DELIVERED_REASON_LABELS[handed.reason]}
          rows={[{ label: deliveryCustomer(handed.delivery), value: `${quantityWords(units)} ${units === 1 ? 'unit' : 'units'}` }]}
        />
        {handed.state === 'waiting' ? <StatusStrip tone="neutral" icon="offline" text={SENDS_WHEN_ONLINE} /> : null}
        {handed.state === 'refused' ? <StatusStrip tone="stop" icon="stop" text={[handed.refusal, RING_THE_OFFICE].filter(Boolean).join(' ')} /> : null}
      </Scroll>
      <BottomBar className="gap-2">
        <Button label={NEXT_DELIVERY} icon="deliver" onPress={onNext} />
        <Button label="Done" variant="tinted" onPress={onDone} />
      </BottomBar>
    </View>
  );
}

