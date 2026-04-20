import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { formatPhoneInput, truncateMiddle } from './rootScreen.helpers';
import { styles } from './rootScreen.styles';

export function RootScreenAuthenticatedView({
  session,
  appScreen,
  setAppScreen,
  screenTitle,
  headerSubtitle,
  properties,
  propertiesQueryIsLoading,
  handleSelectProperty,
  handleSignOut,
  selectedProperty,
  workflow,
  propertyWorkspaceContent,
  accountForm,
  setAccountForm,
  viewerRole,
  handleSaveAccountSettings,
  handleDeleteAccount,
  busy,
  error,
  refreshing,
  supportUrl,
  privacyUrl,
  termsUrl,
  openExternalLink,
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.mobileContent}>
        <ScrollView contentContainerStyle={styles.mobileShell}>
          <View style={styles.mobileTopBar}>
            <View style={styles.topBarSide}>
              {appScreen === 'home' ? (
                <Pressable onPress={() => setAppScreen('settings')} style={styles.topIconButton}>
                  <Text style={styles.topIconGlyph}>{'\u2699'}</Text>
                </Pressable>
              ) : appScreen === 'property' || appScreen === 'settings' ? (
                <Pressable onPress={() => setAppScreen('home')} style={styles.topIconButton}>
                  <Text style={styles.topIconGlyph}>{'\u2039'}</Text>
                </Pressable>
              ) : (
                <View style={styles.topIconPlaceholder} />
              )}
            </View>
            <View style={styles.mobileHeaderCopy}>
              {appScreen === 'home' ? (
                <>
                  <Text style={styles.mobileTitle}>Home Advisor</Text>
                  <Text style={styles.mobilePoweredBy}>powered by</Text>
                  <Text style={styles.mobileBrand}>Workside Software</Text>
                  <Text style={styles.mobileSubtitle}>{headerSubtitle}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.mobileScreenTitle}>{screenTitle}</Text>
                  {headerSubtitle ? <Text style={styles.mobileScreenSubtitle}>{headerSubtitle}</Text> : null}
                </>
              )}
            </View>
            <View style={styles.topBarSide}>
              {appScreen === 'home' ? (
                <Pressable onPress={handleSignOut} style={styles.topIconButton}>
                  <Text style={styles.topIconGlyph}>{'\u21B1'}</Text>
                </Pressable>
              ) : appScreen === 'property' ? (
                <Pressable onPress={() => setAppScreen('settings')} style={styles.topIconButton}>
                  <Text style={styles.topIconGlyph}>{'\u2699'}</Text>
                </Pressable>
              ) : (
                <View style={styles.topIconPlaceholder} />
              )}
            </View>
          </View>

          {appScreen === 'home' ? (
            <View style={styles.mobileCard}>
              <Text style={styles.homeWelcomeTitle}>Welcome, {session.user.firstName || 'there'}</Text>
              <Text style={styles.homeWelcomeMeta}>
                {properties.length} {properties.length === 1 ? 'property' : 'properties'} connected
              </Text>
              {properties.length ? <Text style={styles.homeHintText}>Select a property to begin.</Text> : null}
              <View style={styles.homePropertyList}>
                {properties.length ? (
                  properties.map((property) => (
                    <Pressable
                      key={property.id}
                      onPress={() => handleSelectProperty(property.id)}
                      style={styles.homePropertyCard}
                    >
                      <View style={styles.homePropertyCopy}>
                        <Text style={styles.homePropertyTitle}>{property.title}</Text>
                        <Text style={styles.homePropertyMeta}>
                          {[property.city, property.state].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                      <Text style={styles.homePropertyArrow}>{'\u203A'}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.body}>
                    {propertiesQueryIsLoading
                      ? 'Loading your properties...'
                      : 'No properties were found for this account yet.'}
                  </Text>
                )}
              </View>
            </View>
          ) : null}

          {appScreen === 'settings' ? (
            <View style={styles.mobileCard}>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>Account</Text>
                <TextInput
                  placeholder="First name"
                  placeholderTextColor="#7d8a8f"
                  style={styles.input}
                  value={accountForm.firstName}
                  onChangeText={(value) =>
                    setAccountForm((current) => ({ ...current, firstName: value }))
                  }
                />
                <TextInput
                  placeholder="Last name"
                  placeholderTextColor="#7d8a8f"
                  style={styles.input}
                  value={accountForm.lastName}
                  onChangeText={(value) =>
                    setAccountForm((current) => ({ ...current, lastName: value }))
                  }
                />
                <View style={styles.settingsInfoCard}>
                  <Text style={styles.settingsInfoLabel}>Email</Text>
                  <Text style={styles.settingsInfoValue} numberOfLines={1}>
                    {truncateMiddle(session.user.email)}
                  </Text>
                </View>
                <TextInput
                  placeholder="Mobile number"
                  placeholderTextColor="#7d8a8f"
                  style={styles.input}
                  keyboardType="phone-pad"
                  value={accountForm.mobilePhone}
                  onChangeText={(value) =>
                    setAccountForm((current) => ({
                      ...current,
                      mobilePhone: formatPhoneInput(value),
                    }))
                  }
                />
                <View style={styles.settingsInfoCard}>
                  <Text style={styles.settingsInfoLabel}>Account Type</Text>
                  <Text style={styles.settingsInfoValue} numberOfLines={1}>
                    {viewerRole === 'agent' ? 'Realtor / Agent' : 'Seller'}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    setAccountForm((current) => ({
                      ...current,
                      smsOptIn: !current.smsOptIn,
                    }))
                  }
                  style={styles.settingsRowButton}
                >
                  <Text style={styles.settingsRowTitle}>
                    {accountForm.smsOptIn ? 'SMS updates enabled' : 'SMS updates disabled'}
                  </Text>
                  <Text style={styles.settingsRowMeta}>
                    Receive transactional listing and provider updates by SMS. Reply STOP to opt out.
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveAccountSettings}
                  style={[styles.button, styles.buttonPrimary]}
                  disabled={busy}
                >
                  <Text style={styles.buttonText}>Save account settings</Text>
                </Pressable>
              </View>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>App Info & Legal</Text>
                <Pressable onPress={() => openExternalLink(supportUrl)} style={styles.settingsRowButton}>
                  <Text style={styles.settingsRowTitle}>Contact Support</Text>
                  <Text style={styles.settingsRowMeta}>support@worksideadvisor.com</Text>
                </Pressable>
                <Pressable onPress={() => openExternalLink(privacyUrl)} style={styles.settingsRowButton}>
                  <Text style={styles.settingsRowTitle}>Privacy Notice</Text>
                  <Text style={styles.settingsRowMeta}>Review how Workside handles your data.</Text>
                </Pressable>
                <Pressable onPress={() => openExternalLink(termsUrl)} style={styles.settingsRowButton}>
                  <Text style={styles.settingsRowTitle}>Terms of Service</Text>
                  <Text style={styles.settingsRowMeta}>Read the current mobile and web terms.</Text>
                </Pressable>
              </View>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionLabel}>Danger Zone</Text>
                <Pressable onPress={handleDeleteAccount} style={styles.settingsDangerCard} disabled={busy}>
                  <Text style={styles.settingsDangerTitle}>Delete Account</Text>
                  <Text style={styles.settingsDangerMeta}>
                    Permanently delete your account and all related property data.
                  </Text>
                </Pressable>
                <Pressable onPress={handleSignOut} style={[styles.button, styles.buttonSecondary]}>
                  <Text style={styles.buttonSecondaryText}>Sign Out</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {appScreen === 'property' && selectedProperty ? (
            <View style={styles.mobileCard}>
              <View style={styles.propertyHeroCard}>
                {workflow ? (
                  <View style={styles.propertyHeroStats}>
                    <View style={styles.propertyHeroStatChip}>
                      <Text style={styles.propertyHeroStatText}>{workflow.marketReadyScore}/100 ready</Text>
                    </View>
                    <View style={styles.propertyHeroStatChip}>
                      <Text style={styles.propertyHeroStatText}>{workflow.completionPercent}% complete</Text>
                    </View>
                  </View>
                ) : null}
              </View>
              {propertyWorkspaceContent}
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {busy || refreshing ? <ActivityIndicator color="#d28859" style={styles.spinner} /> : null}
        </ScrollView>
      </View>
      <View style={styles.mobileFooterDock}>
        <Text style={styles.mobileFooter}>Copyright 2026 Workside Software LLC</Text>
      </View>
    </View>
  );
}
