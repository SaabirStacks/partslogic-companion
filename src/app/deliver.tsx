import { router } from 'expo-router';
import { useState } from 'react';

import { useStepBack } from '@/features/bins/use-step-back';
import { DeliverList, DeliverReceipt, DropView, NotDeliveredSheet, SignView } from '@/features/deliver/deliver-views';
import { useDeliver } from '@/features/deliver/use-deliver';

// Deliver (S5a-2c): the orders out for delivery from the branch, the driver's own first. At the door the customer
// types a name and signs with a finger, and Delivered sends it (or saves it until there's signal); Not delivered
// brings the parts back with why. PartsLogic then shows who signed on the order, its history and the delivery note.
export default function Deliver() {
  const deliver = useDeliver();
  const [asking, setAsking] = useState(false);
  // Android's back button goes back a step: Sign to the drop, the drop to the list (critique). Nothing signed is lost
  // either way: the drop and its signature are kept on the phone.
  useStepBack(deliver.handed ? null : deliver.signing ? deliver.back : deliver.drop ? deliver.close : null);

  if (deliver.handed) {
    return (
      <DeliverReceipt
        handed={deliver.handed}
        now={new Date().toISOString()}
        onNext={deliver.next}
        onDone={() => {
          deliver.next();
          router.back();
        }}
      />
    );
  }
  if (!deliver.drop) return <DeliverList list={deliver.list} onOpen={deliver.open} />;
  if (deliver.signing) {
    return (
      <SignView
        delivery={deliver.drop}
        signing={deliver.signing}
        problem={deliver.problem}
        onName={deliver.name}
        onDraw={deliver.draw}
        onClear={deliver.clear}
        onDelivered={() => void deliver.delivered()}
        onBack={deliver.back}
      />
    );
  }
  return (
    <>
      <DropView delivery={deliver.drop} online={deliver.list.online} onSign={deliver.sign} onNotDelivered={() => setAsking(true)} onClose={deliver.close} />
      <NotDeliveredSheet
        key={asking ? 'open' : 'closed'}
        order={deliver.drop.order}
        visible={asking}
        onSave={async (reason, note) => {
          const wrong = await deliver.notDelivered(reason, note);
          if (!wrong) setAsking(false);
          return wrong;
        }}
        onClose={() => setAsking(false)}
      />
    </>
  );
}
