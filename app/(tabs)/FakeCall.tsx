import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { playRecording, stopFakeCall } from '../../services/FakeCallService';
import { getSelectedRecording, Recording } from '../../services/AudioService';
import FakeCallModal from '../../components/FakeCallModal';
import CallActiveModal from '../../components/CallActiveModal';

export default function FakeCallScreen() {
  const [selectedRecording, setSelectedRecordingState] = useState<Recording | null>(
    null
  );
  const [isCallActive, setIsCallActive] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [callerName, setCallerName] = useState('John Doe');
  const [callDuration, setCallDuration] = useState(0);
  const router = useRouter();
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadSelectedRecording = useCallback(async () => {
    const recording = await getSelectedRecording();
    setSelectedRecordingState(recording);
    console.log('Loaded selected recording:', recording);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSelectedRecording();
    }, [loadSelectedRecording])
  );

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(handleNotification);
    return () => {
      subscription.remove();
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      stopFakeCall();
    };
  }, []);

  const handleGetFakeCall = async () => {
    if (selectedRecording) {
      const randomName = getRandomCallerName();
      setCallerName(randomName);
      console.log('Initiating fake call with recording:', selectedRecording);
      setIsModalVisible(true);
      await initiateFakeCall(selectedRecording);
    } else {
      console.log('No recording selected');
      Alert.alert('No Ringtone Selected', 'Please select a ringtone in Recordings Manager.');
    }
  };

  const initiateFakeCall = async (recording: Recording) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Incoming Call',
          body: `Call from ${callerName}`,
          data: { recording },
        },
        trigger: { seconds: 1 },
      });
    } catch (error) {
      console.error('Error initiating fake call:', error);
    }
  };

  const handleAcceptCall = () => {
    setIsModalVisible(false);
    setIsCallActive(true);
    startCallTimer();
    if (selectedRecording) {
      console.log('Playing selected recording:', selectedRecording);
      playRecording(selectedRecording);
    } else {
      console.error('No recording selected for playback');
    }
  };

  const handleDeclineCall = () => {
    setIsModalVisible(false);
    stopFakeCall();
    Alert.alert('Call Ended', 'The fake call has been ended.');
  };

  const handleEndCall = () => {
    setIsCallActive(false);
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    setCallDuration(0);
    stopFakeCall();
    Alert.alert('Call Ended', 'The fake call has been ended.');
  };

  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const getRandomCallerName = (): string => {
    const callerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan'];
    return callerNames[Math.floor(Math.random() * callerNames.length)];
  };

  const handleNotification = (notification: Notifications.Notification) => {
    console.log('Notification received:', notification);
    // Optionally handle foreground notifications if needed
  };

  const navigateToRecordingsManager = () => {
    router.push('/RecordingsManager');
  };

  return (
    <View style={styles.container}>
      {/* Header Section (Removed Select Recording Button) */}
      <View style={styles.header}>
        <Text style={styles.title}>Fake Call Simulator</Text>
      </View>

      {/* Start Fake Call Button */}
      <TouchableOpacity style={styles.callButton} onPress={handleGetFakeCall}>
        <Ionicons name="call-outline" size={48} color="white" />
        <Text style={styles.buttonText}>Start Fake Call</Text>
      </TouchableOpacity>

      {/* Select Recording Button at the Bottom */}
      <TouchableOpacity style={styles.selectRecordingButton} onPress={navigateToRecordingsManager}>
        <Ionicons name="musical-notes-outline" size={24} color="#333" />
        <Text style={styles.selectRecordingText}>Select Recording</Text>
      </TouchableOpacity>

      {/* Modals */}
      <FakeCallModal
        isVisible={isModalVisible}
        callerName={callerName}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />

      <CallActiveModal
        isVisible={isCallActive}
        callDuration={callDuration}
        onEndCall={handleEndCall}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#F0F4F7',
    justifyContent: 'space-between', // Ensure space between elements
  },
  header: {
    // Removed settingsButton style
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  callButton: {
    backgroundColor: '#0cab39',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 50,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3.84,
    flexDirection: 'column',
    alignSelf: 'center',
    marginTop: 100,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    marginTop: 10,
    fontWeight: '600',
  },
  selectRecordingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 40, // Adjust as needed
  },
  selectRecordingText: {
    color: '#333',
    fontSize: 16,
    marginLeft: 8,
  },
});
