import { View } from 'react-native';

import { Choice } from '@/ui/choice';
import type { AppRole } from '@/vendor/partslogic/shared/members';
import { ROLE_HINTS, roleName } from '@/vendor/partslogic/shared/people';

// The roles someone may be given, each with what it adds, highest last as the list reads down the page.
export function RoleChoices({
  roles,
  value,
  onChoose,
  disabled = false,
}: {
  roles: readonly AppRole[];
  value: AppRole | null;
  onChoose: (role: AppRole) => void;
  disabled?: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" className="gap-2">
      {roles.map((role) => (
        <Choice
          key={role}
          title={roleName(role)}
          detail={ROLE_HINTS[role]}
          detailLines={2}
          selected={value === role}
          pick="role"
          onPress={() => {
            if (!disabled && role !== value) onChoose(role);
          }}
        />
      ))}
    </View>
  );
}
