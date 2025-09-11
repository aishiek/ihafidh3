import React from 'react';
import { 
  ScrollView, 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity,
  Linking,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { 
  ArrowLeft, 
  Mail, 
  Heart, 
  Star, 
  BookOpen,
  Target,
  Users,
  Globe
} from 'lucide-react-native';

export default function AboutScreen() {
  const handleEmailPress = () => {
    Linking.openURL('mailto:iHafidhapp@gmail.com?subject=iHafidh App Feedback');
  };

  const handleBack = () => {
    router.back();
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Us</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Logo/Icon */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <BookOpen size={48} color="#2196F3" />
          </View>
          <Text style={styles.appName}>iHafidh</Text>
          <Text style={styles.appTagline}>Your Quran Memorization Companion</Text>
        </View>
        
        {/* Mission Statement */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Target size={20} color="#2196F3" />
            <Text style={styles.sectionTitle}>Our Mission</Text>
          </View>
          <Text style={styles.sectionText}>
            iHafidh is dedicated to making Quran memorization accessible and engaging for Muslims worldwide. 
            We combine traditional learning methods with modern technology to help you on your journey to 
            becoming a Hafidh.
          </Text>
        </View>
        
        {/* Features */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Star size={20} color="#FFD700" />
            <Text style={styles.sectionTitle}>Key Features</Text>
          </View>
          <View style={styles.featureList}>
          <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Comprehensive progress tracking for all 114 Surahs and 30 Juz</Text>
          </View>
          <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Smart revision scheduling with daily and weekly goals</Text>
          </View>
          <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Achievement badges to motivate your journey</Text>
          </View>
          <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Daily streak tracking and time spent analytics</Text>
          </View>
          <View style={styles.featureItem}>
              <Text style={styles.featureBullet}>•</Text>
              <Text style={styles.featureText}>Beautiful themes and dark mode support</Text>
          </View>
          </View>
        </View>
        
        {/* Community */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={20} color="#4CAF50" />
            <Text style={styles.sectionTitle}>Join Our Community</Text>
          </View>
          <Text style={styles.sectionText}>
            Join thousands of Muslims around the world who are using iHafidh to memorize the Holy Quran. 
            Your journey to becoming a Hafidh starts here.
          </Text>
        </View>

        {/* Contact Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Mail size={20} color="#9C27B0" />
            <Text style={styles.sectionTitle}>Contact Us</Text>
          </View>
          <Text style={styles.sectionText}>
            We value your feedback and suggestions to make iHafidh better for the entire Ummah.
          </Text>
          <TouchableOpacity 
            style={styles.emailButton}
            onPress={handleEmailPress}
          >
            <Mail size={20} color="#ffffff" />
            <Text style={styles.emailButtonText}>iHafidhapp@gmail.com</Text>
          </TouchableOpacity>
          <Text style={styles.contactNote}>
            Please send your feedback, suggestions, or report any issues to the email above. 
            We read every message and strive to improve the app based on your valuable input.
          </Text>
        </View>
        
        {/* Made with Love */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with</Text>
          <Heart size={16} color="#F44336" style={{ marginHorizontal: 4 }} />
          <Text style={styles.footerText}>for the Ummah</Text>
        </View>

        {/* Version Info */}
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 16,
    color: '#888888',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#B0B0B0',
  },
  featureList: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  featureBullet: {
    fontSize: 16,
    color: '#2196F3',
    marginRight: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#B0B0B0',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  contactNote: {
    fontSize: 14,
    lineHeight: 20,
    color: '#888888',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 14,
    color: '#888888',
  },
  versionText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
});