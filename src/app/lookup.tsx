import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { useLookUp, type LookUpView } from '@/features/lookup/use-look-up';
import { PartRow } from '@/features/part/part-row';
import { CameraScanner } from '@/scan/camera-scanner';
import { ScanField } from '@/scan/scan-field';
import { useSession } from '@/session/session-provider';
import { Button } from '@/ui/button';
import { ListGroup } from '@/ui/list';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { useColour } from '@/ui/theme';
import { barcodeProblem } from '@/vendor/partslogic/shared/gtin';
import { roleAtLeast } from '@/vendor/partslogic/shared/members';

export default function LookUp() {
  const lookUp = useLookUp();
  const { view, recent } = lookUp;

  return (
    <Screen>
      <View className="gap-3 px-4 pb-10 pt-2">
        <View className="h-56 overflow-hidden rounded-plate">
          <CameraScanner enabled={!lookUp.busy} onScan={lookUp.scan} />
        </View>
        <ScanField placeholder="Part number or barcode" onSubmit={lookUp.type} editable={!lookUp.busy} />
        <Answer view={view} lookUp={lookUp} />
        {view.kind === 'results' ? <Results view={view} lookUp={lookUp} /> : null}
        {view.kind !== 'results' && recent.length > 0 ? (
          <View className="mt-3">
            <ListGroup title="Recent">
              {recent.map((part, index) => (
                <PartRow
                  key={part.partId}
                  {...part}
                  onPress={() => lookUp.openPart(part)}
                  last={index === recent.length - 1}
                />
              ))}
            </ListGroup>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

type LookUpApi = ReturnType<typeof useLookUp>;

function Answer({ view, lookUp }: { view: LookUpView; lookUp: LookUpApi }) {
  const { state } = useSession();
  const colourOf = useColour();
  const canCount = state.status === 'member' && roleAtLeast(state.member.role, 'counter');

  switch (view.kind) {
    case 'working':
      return (
        <View className="flex-row items-center gap-3 px-1 py-2">
          <ActivityIndicator color={colourOf('quiet-ink')} />
          <Text className="text-base tabular-nums text-quiet-ink">Looking up {view.code}</Text>
        </View>
      );
    case 'bin':
      return (
        <Panel icon="count" iconColour="mandatory-ink" title={`Bin ${view.bin}`} body={`In ${view.location}.`}>
          {canCount ? (
            <Button
              label="Count this bin"
              onPress={() => {
                lookUp.clear();
                router.navigate({
                  pathname: '/count',
                  params: { binId: String(view.binId), bin: view.bin, location: view.location },
                });
              }}
            />
          ) : null}
          <Button label="Done" variant="secondary" onPress={lookUp.clear} />
        </Panel>
      );
    case 'unknown':
      return (
        <Panel
          icon="warning"
          iconColour="warning-ink"
          title={`No part has the code ${view.code}`}
          body={barcodeProblem(view.code) ?? 'It may be a supplier code PartsLogic hasn’t seen yet. Try the part number instead.'}>
          {canCount ? (
            <Button
              label="Add as new part"
              onPress={() => router.push({ pathname: '/quick-add', params: { code: view.code } })}
            />
          ) : null}
          <Button label="Search instead" variant="secondary" onPress={() => lookUp.search(view.code)} />
        </Panel>
      );
    case 'offline':
      return (
        <Panel
          icon="offline"
          title="No signal"
          body={`${view.code} isn’t in the scan list saved on this phone, so it can’t be checked until you’re back online.`}>
          <Button label="Try again" variant="secondary" onPress={() => lookUp.retry(view.code, view.typed)} />
        </Panel>
      );
    case 'error':
      return (
        <Panel icon="warning" iconColour="stop-ink" title="That didn’t work" body={view.message}>
          <Button label="Try again" variant="secondary" onPress={() => lookUp.retry(view.code, view.typed)} />
        </Panel>
      );
    default:
      return null;
  }
}

function Results({ view, lookUp }: { view: Extract<LookUpView, { kind: 'results' }>; lookUp: LookUpApi }) {
  if (view.results.length === 0) {
    return (
      <Panel
        icon="lookup"
        title={`No match for ${view.query}`}
        body="Check the number, or scan the barcode on the box."
      />
    );
  }
  return (
    <ListGroup title={`${view.results.length === 30 ? 'First 30' : view.results.length} ${view.results.length === 1 ? 'match' : 'matches'}`}>
      {view.results.map((result, index) => (
        <PartRow
          key={result.partId}
          brand={result.brand}
          number={result.number}
          description={result.description}
          onPress={() =>
            lookUp.openPart({
              partId: result.partId,
              brand: result.brand,
              number: result.number,
              description: result.description,
            })
          }
          last={index === view.results.length - 1}
        />
      ))}
    </ListGroup>
  );
}
