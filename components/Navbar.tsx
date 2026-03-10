import { useRouter, useSegments } from 'expo-router';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BREAKPOINT = 768;

// ── Shared sub-components ────────────────────────────────────────────────────

interface LinkProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

const NavLink = React.memo(function NavLink({ label, active, onPress }: LinkProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
    >
      <Text style={[styles.link, active && styles.linkActive]}>{label}</Text>
    </TouchableOpacity>
  );
});

const DropdownItem = React.memo(function DropdownItem({ label, active, onPress }: LinkProps) {
  return (
    <TouchableOpacity
      style={[styles.dropItem, active && styles.dropItemActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.dropLabel, active && styles.dropLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
});

// ── Main component ────────────────────────────────────────────────────────────

export default function Navbar() {
  const router = useRouter();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  const isDesktop = width >= BREAKPOINT;
  const current = segments[0] ?? '';

  function nav(path: string) {
    setMenuOpen(false);
    router.push(path as any);
  }

  const active = (route: string) => current === route;

  return (
    <View style={styles.wrapper}>
      {/* ── Bar ──────────────────────────────────────────────────── */}
      <View style={[styles.bar, { paddingTop: insets.top }]}>

        {isDesktop ? (
          // ── Desktop / Tablet 3-column layout ──
          <>
            {/* Left: brand */}
            <TouchableOpacity onPress={() => nav('/')} activeOpacity={0.8} style={styles.leftSection}>
              <Text style={styles.brand}>CLOCKEAPP</Text>
            </TouchableOpacity>

            {/* Center: nav links */}
            <View style={styles.centerLinks}>
              <NavLink label="Analytics" active={active('stats')} onPress={() => nav('/stats')} />
              <NavLink label="Logs"      active={active('history')} onPress={() => nav('/history')} />
            </View>

            {/* Right: profile */}
            <View style={styles.rightSection}>
              <NavLink label="Profile" active={active('profile')} onPress={() => nav('/profile')} />
            </View>
          </>
        ) : (
          // ── Mobile: brand + hamburger ──
          <>
            <TouchableOpacity onPress={() => nav('/')} activeOpacity={0.8} style={styles.mobileBrand}>
              <Text style={styles.brand}>CLOCKEAPP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMenuOpen((v) => !v)}
              activeOpacity={0.7}
              style={styles.hamburger}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.hamburgerIcon}>{menuOpen ? '✕' : '☰'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Mobile dropdown ──────────────────────────────────────── */}
      {!isDesktop && menuOpen && (
        <View style={styles.dropdown}>
          <DropdownItem label="Profile"   active={active('profile')} onPress={() => nav('/profile')} />
          <DropdownItem label="Analytics" active={active('stats')}   onPress={() => nav('/stats')} />
          <DropdownItem label="Logs"      active={active('history')} onPress={() => nav('/history')} />
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#233d4d',
    borderBottomWidth: 1,
    borderBottomColor: '#2d4f62',
    zIndex: 10,
  },
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  // ── Desktop sections ──────────────────────────────────────────────────────
  leftSection: {
    flex: 1,
    justifyContent: 'center',
  },
  centerLinks: {
    flexDirection: 'row',
    gap: 28,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  // ── Mobile sections ───────────────────────────────────────────────────────
  mobileBrand: {
    flex: 1,
    justifyContent: 'center',
  },
  hamburger: {
    paddingLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerIcon: {
    fontSize: 22,
    color: '#7aa3b8',
    lineHeight: 26,
  },

  // ── Brand ─────────────────────────────────────────────────────────────────
  brand: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fe7f2d',
    letterSpacing: 3,
  },

  // ── Nav links (desktop) ───────────────────────────────────────────────────
  link: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7aa3b8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  linkActive: {
    color: '#fe7f2d',
  },

  // ── Dropdown (mobile) ─────────────────────────────────────────────────────
  dropdown: {
    borderTopWidth: 1,
    borderTopColor: '#2d4f62',
    paddingVertical: 4,
  },
  dropItem: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  dropItemActive: {
    backgroundColor: '#1e3545',
  },
  dropLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7aa3b8',
  },
  dropLabelActive: {
    color: '#fe7f2d',
  },
});
