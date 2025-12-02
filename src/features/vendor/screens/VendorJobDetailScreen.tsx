import { useAuth } from '@/src/contexts/AuthContext';
import {
    getPOByRequestId,
    getProgressUpdates,
    requestClosure,
    startWork,
    submitProgressUpdate,
    type PurchaseOrder,
} from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395', green: '#007A4D', gold: '#FFB81C', red: '#DE3831' };

interface JobDetails {
  id: string;
  title: string;
  description: string;
  status: string;
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
  };
  category?: {
    id: string;
    name: string;
  };
  images?: string[];
  po_id?: string | null;
  selected_quote_id?: string | null;
  created_at: string;
}

export default function VendorJobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<JobDetails | null>(null);
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeUntilStart, setTimeUntilStart] = useState<string>('');
  const [timeUntilEnd, setTimeUntilEnd] = useState<string>('');
  const [progressUpdates, setProgressUpdates] = useState<any[]>([]);
  const [closureReport, setClosureReport] = useState<any | null>(null);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [showClosureForm, setShowClosureForm] = useState(false);

  const fetchJobDetails = useCallback(async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Fetch maintenance request details
      const { getMaintenanceRequestById } = await import('@/src/features/maintenance/api');
      const jobData: any = await getMaintenanceRequestById(id);
      setJob(jobData);

      // Fetch PO details if available
      if (jobData?.po_id) {
        const poData = await getPOByRequestId(id) || await (await import('@/src/features/maintenance/api')).getPOById(jobData.po_id);
        setPO(poData);
      }

      // Fetch progress updates if work is in progress
      if (jobData?.status === 'in_progress') {
        const updates = await getProgressUpdates(id);
        setProgressUpdates(updates);
      }

      // Fetch closure report if closure requested
      if (jobData?.closure_requested_at) {
        const { getClosureReport } = await import('@/src/features/maintenance/api');
        const closure = await getClosureReport(id);
        setClosureReport(closure);
      }
    } catch (error: any) {
      console.error('Error fetching job details:', error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (id && user?.id) {
        fetchJobDetails();
      }
    }, [id, user?.id, fetchJobDetails])
  );

  // Calculate time until start and end
  useEffect(() => {
    if (!po?.scheduled_start_date || !po?.scheduled_start_time) return;

    const updateTimers = () => {
      try {
        const now = new Date();
        
        // Try to parse the date - handle different formats
        let startDateTime: Date;
        
        if (po.scheduled_start_date?.includes('T')) {
          startDateTime = new Date(po.scheduled_start_date);
        } else {
          startDateTime = new Date(`${po.scheduled_start_date}T${po.scheduled_start_time}`);
        }
        
        // Check if date is valid
        if (isNaN(startDateTime.getTime())) {
          console.warn('⚠️ Invalid date in timer, showing ready');
          setTimeUntilStart('✅ Ready to start!');
          setTimeUntilEnd('TBD');
          return;
        }
        
        const diffStart = startDateTime.getTime() - now.getTime();
        
        if (diffStart > 0) {
          // Time is in the future
          const days = Math.floor(diffStart / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diffStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diffStart % (1000 * 60 * 60)) / (1000 * 60));
          
          if (days > 0) {
            setTimeUntilStart(`in ${days}d ${hours}h`);
          } else if (hours > 0) {
            setTimeUntilStart(`in ${hours}h ${minutes}m`);
          } else if (minutes > 0) {
            setTimeUntilStart(`in ${minutes}m`);
          } else {
            setTimeUntilStart('in less than 1 minute');
          }
        } else {
          // Time has passed - can start now!
          const hoursPassed = Math.floor(Math.abs(diffStart) / (1000 * 60 * 60));
          if (hoursPassed < 24) {
            setTimeUntilStart('✅ Ready to start now!');
          } else {
            setTimeUntilStart('✅ Ready to start!');
          }
        }

        // Calculate estimated end time (assuming work duration from quote)
        // For now, we'll use a placeholder
        setTimeUntilEnd('TBD');
      } catch (error) {
        console.error('❌ Error in timer calculation:', error);
        setTimeUntilStart('✅ Ready to start!');
        setTimeUntilEnd('TBD');
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [po]);

  const handleViewPO = () => {
    if (job?.po_id) {
      router.push(`/(vendor)/maintenance/${id}/po/${job.po_id}`);
    }
  };

  const handleStartWork = () => {
    Alert.alert(
      '🚀 Start Work',
      'Ready to begin? Make sure you have everything you need!',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Start Now',
          onPress: async () => {
            try {
              if (!user?.id) {
                throw new Error('User not authenticated');
              }

              console.log('🚀 Starting work on job:', id);
              await startWork(id, user.id);
              
              // Refresh job details to show updated status
              await fetchJobDetails();
              
              Alert.alert(
                '✅ Success!',
                'Work started! Remember to submit daily progress updates.',
                [{ text: 'Got it!' }]
              );
            } catch (error: any) {
              console.error('❌ Error starting work:', error);
              Alert.alert('Error', error.message || 'Failed to start work');
            }
          },
        },
      ]
    );
  };

  const handleDailyUpdate = async () => {
    console.log('🔵 handleDailyUpdate clicked');
    
    // Quick test - submit with hardcoded notes
    const testNotes = `Progress update - ${new Date().toLocaleTimeString()}`;
    
    try {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      console.log('🔵 Calling submitProgressUpdate...');
      console.log('🔵 Parameters:', { id, userId: user.id, notes: testNotes });
      
      await submitProgressUpdate(id, user.id, testNotes, []);
      
      console.log('🔵 Progress update submitted successfully');
      
      await fetchJobDetails();
      
      Alert.alert('✅ Success!', `Progress update submitted: ${testNotes}`);
    } catch (error: any) {
      console.error('❌ Error submitting update:', error);
      console.error('❌ Error details:', JSON.stringify(error));
      Alert.alert('Error', error.message || 'Failed to submit update');
    }
  };

  const handleRequestClosure = async () => {
    console.log('🟢 handleRequestClosure clicked');
    
    Alert.alert(
      '🏁 Request Job Closure',
      'This will request closure with test data (2 placeholder photos). Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Closure',
          onPress: async () => {
            try {
              if (!user?.id) {
                throw new Error('User not authenticated');
              }

              const testNotes = `Job completed - ${new Date().toLocaleTimeString()}`;
              const testPhotos = ['photo1.jpg', 'photo2.jpg']; // Placeholder
              
              console.log('🟢 Calling requestClosure...');
              console.log('🟢 Parameters:', { id, userId: user.id, notes: testNotes, photos: testPhotos });
              
              await requestClosure(id, user.id, testNotes, testPhotos);
              
              console.log('🟢 Closure requested successfully');
              
              await fetchJobDetails();
              
              Alert.alert('✅ Success!', 'Closure requested. Waiting for owner approval.');
            } catch (error: any) {
              console.error('❌ Error requesting closure:', error);
              console.error('❌ Error details:', JSON.stringify(error));
              Alert.alert('Error', error.message || 'Failed to request closure');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
          <Text style={styles.loadingText}>Loading job details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.error[500]} />
          <Text style={styles.errorText}>Job not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Check if vendor can start work
  // Requirements: PO sent to vendor AND scheduled start time has arrived AND status is 'assigned'
  const now = new Date();
  let canStartWork = false;
  
  console.log('🔍 Job Detail Debug:', {
    jobId: job.id,
    jobStatus: job.status,
    poId: po?.id,
    poSentToVendor: po?.sent_to_vendor_at,
    scheduledDate: po?.scheduled_start_date,
    scheduledTime: po?.scheduled_start_time,
    currentTime: now.toISOString(),
  });
  
  if (po?.sent_to_vendor_at && job.status === 'assigned') {
    if (po.scheduled_start_date && po.scheduled_start_time) {
      try {
        // Try to parse the date - handle different formats
        let startDateTime: Date;
        
        // Check if scheduled_start_date is already a full timestamp
        if (po.scheduled_start_date.includes('T')) {
          startDateTime = new Date(po.scheduled_start_date);
        } else {
          // Combine date and time
          startDateTime = new Date(`${po.scheduled_start_date}T${po.scheduled_start_time}`);
        }
        
        // Check if date is valid
        if (isNaN(startDateTime.getTime())) {
          console.warn('⚠️ Invalid date format, allowing start:', {
            date: po.scheduled_start_date,
            time: po.scheduled_start_time,
          });
          canStartWork = true;
        } else {
          console.log('⏰ Time check:', {
            scheduledDateTime: startDateTime.toISOString(),
            now: now.toISOString(),
            canStart: now >= startDateTime,
            diff: now.getTime() - startDateTime.getTime(),
          });
          canStartWork = now >= startDateTime;
        }
      } catch (error) {
        console.error('❌ Error parsing date:', error);
        console.log('Date values:', {
          date: po.scheduled_start_date,
          time: po.scheduled_start_time,
        });
        // If date parsing fails, allow start (fail open)
        canStartWork = true;
      }
    } else {
      // If no scheduled time, can start immediately after PO is sent
      console.log('✅ No scheduled time, can start immediately');
      canStartWork = true;
    }
  } else {
    console.log('❌ Cannot start work:', {
      poSent: !!po?.sent_to_vendor_at,
      statusIsAssigned: job.status === 'assigned',
    });
  }
  
  const isWorkStarted = job.status === 'in_progress';
  const isWaitingForScheduledTime = po?.sent_to_vendor_at && job.status === 'assigned' && !canStartWork;
  
  console.log('📊 Final state:', {
    canStartWork,
    isWorkStarted,
    isWaitingForScheduledTime,
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Timeline */}
        <View style={styles.timelineContainer}>
          <Text style={styles.timelineTitle}>📍 Step 4 of 7: Ready to Work</Text>
          <View style={styles.timelineBar}>
            <View style={[styles.timelineStep, styles.timelineStepComplete]} />
            <View style={[styles.timelineStep, styles.timelineStepComplete]} />
            <View style={[styles.timelineStep, styles.timelineStepComplete]} />
            <View style={[styles.timelineStep, styles.timelineStepActive]} />
            <View style={styles.timelineStep} />
            <View style={styles.timelineStep} />
            <View style={styles.timelineStep} />
          </View>
          <View style={styles.timelineLabels}>
            <Text style={styles.timelineLabelComplete}>✓ Quote</Text>
            <Text style={styles.timelineLabelComplete}>✓ PO</Text>
            <Text style={styles.timelineLabelComplete}>✓ Accept</Text>
            <Text style={styles.timelineLabelActive}>● Work</Text>
            <Text style={styles.timelineLabel}>Update</Text>
            <Text style={styles.timelineLabel}>Done</Text>
            <Text style={styles.timelineLabel}>💰</Text>
          </View>
        </View>

        {/* Next Step Card */}
        <View style={styles.nextStepCard}>
          <View style={styles.nextStepHeader}>
            <Ionicons name="flash" size={24} color={RSA.gold} />
            <Text style={styles.nextStepTitle}>NEXT STEP:</Text>
          </View>
          {canStartWork ? (
            <>
              <Text style={styles.nextStepText}>✅ Ready! Click "Start Work" below</Text>
              <Text style={styles.nextStepSubtext}>📸 Take photos as you work</Text>
            </>
          ) : isWorkStarted ? (
            <>
              <Text style={styles.nextStepText}>Submit today's progress update</Text>
              <Text style={styles.nextStepSubtext}>📸 Take photos of work done</Text>
            </>
          ) : !po?.sent_to_vendor_at ? (
            <>
              <Text style={styles.nextStepText}>⏳ Waiting for owner</Text>
              <Text style={styles.nextStepSubtext}>Owner needs to send the PO first</Text>
            </>
          ) : isWaitingForScheduledTime ? (
            <>
              <Text style={styles.nextStepText}>⏰ Wait until scheduled time</Text>
              <Text style={styles.nextStepSubtext}>You can start {timeUntilStart}</Text>
            </>
          ) : (
            <>
              <Text style={styles.nextStepText}>Almost ready</Text>
              <Text style={styles.nextStepSubtext}>Check back soon</Text>
            </>
          )}
        </View>

        {/* Timing Information */}
        {po?.scheduled_start_date && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⏰ Work Schedule</Text>
            <View style={styles.timingCard}>
              <View style={styles.timingRow}>
                <View style={styles.timingIcon}>
                  <Ionicons name="play-circle" size={24} color={RSA.green} />
                </View>
                <View style={styles.timingInfo}>
                  <Text style={styles.timingLabel}>Start Time</Text>
                  <Text style={styles.timingValue}>
                    {new Date(po.scheduled_start_date).toLocaleDateString('en-ZA', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })} at {po.scheduled_start_time}
                  </Text>
                  <Text style={styles.timingCountdown}>{timeUntilStart}</Text>
                </View>
              </View>
              
              <View style={styles.timingDivider} />
              
              <View style={styles.timingRow}>
                <View style={styles.timingIcon}>
                  <Ionicons name="stop-circle" size={24} color={RSA.red} />
                </View>
                <View style={styles.timingInfo}>
                  <Text style={styles.timingLabel}>Estimated Completion</Text>
                  <Text style={styles.timingValue}>{timeUntilEnd}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Earnings Reminder */}
        <View style={styles.earningsCard}>
          <Ionicons name="cash" size={32} color={RSA.green} />
          <View style={styles.earningsInfo}>
            <Text style={styles.earningsLabel}>You'll earn</Text>
            <Text style={styles.earningsAmount}>
              R {po?.total_amount?.toLocaleString() || '0'}
            </Text>
            <Text style={styles.earningsSubtext}>After platform fee</Text>
          </View>
        </View>

        {/* Property Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Property</Text>
          <View style={styles.propertyCard}>
            <View style={styles.propertyIcon}>
              <Ionicons name="home" size={24} color={RSA.green} />
            </View>
            <View style={styles.propertyInfo}>
              <Text style={styles.propertyTitle}>{job.property?.title || 'Property'}</Text>
              <Text style={styles.propertyAddress}>{job.property?.address || 'Address not available'}</Text>
              <Text style={styles.propertyCity}>{job.property?.city || ''}</Text>
            </View>
          </View>
        </View>

        {/* PO Details */}
        {po && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📄 Purchase Order</Text>
            <TouchableOpacity style={styles.poCard} onPress={handleViewPO}>
              <View style={styles.poIcon}>
                <Ionicons name="document-text" size={24} color={RSA.blue} />
              </View>
              <View style={styles.poInfo}>
                <Text style={styles.poLabel}>PO Number</Text>
                <Text style={styles.poNumber}>{po.po_number}</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.gray[400]} />
            </TouchableOpacity>
          </View>
        )}

        {/* Original Request */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 What to do</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.jobTitle}>{job.title}</Text>
            <Text style={styles.jobDescription}>{job.description}</Text>
          </View>
        </View>

        {/* Progress Updates */}
        {isWorkStarted && progressUpdates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Progress Updates (Day {progressUpdates.length})</Text>
            {progressUpdates.map((update, index) => (
              <View key={update.id} style={styles.updateCard}>
                <View style={styles.updateHeader}>
                  <Text style={styles.updateDate}>
                    {new Date(update.update_date).toLocaleDateString('en-ZA', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                  <Text style={styles.updateDay}>Day {progressUpdates.length - index}</Text>
                </View>
                <Text style={styles.updateNotes}>{update.notes}</Text>
                {update.photos && update.photos.length > 0 && (
                  <Text style={styles.updatePhotos}>📸 {update.photos.length} photos</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Closure Status */}
        {closureReport && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏁 Job Closure</Text>
            <View style={styles.closureCard}>
              <View style={styles.closureHeader}>
                <Ionicons 
                  name={closureReport.status === 'approved' ? 'checkmark-circle' : closureReport.status === 'rejected' ? 'close-circle' : 'time'} 
                  size={32} 
                  color={closureReport.status === 'approved' ? RSA.green : closureReport.status === 'rejected' ? RSA.red : RSA.gold} 
                />
                <Text style={styles.closureStatus}>
                  {closureReport.status === 'approved' 
                    ? 'Approved' 
                    : closureReport.status === 'rejected'
                    ? 'Changes Requested'
                    : 'Pending Approval'}
                </Text>
              </View>
              <Text style={styles.closureNotes}>{closureReport.completion_notes}</Text>
              {closureReport.rejection_reason && (
                <View style={styles.rejectionCard}>
                  <Text style={styles.rejectionLabel}>Owner's Feedback:</Text>
                  <Text style={styles.rejectionReason}>{closureReport.rejection_reason}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action Buttons */}
      {canStartWork && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.startButton} onPress={handleStartWork}>
            <Ionicons name="play-circle" size={24} color="#FFFFFF" />
            <Text style={styles.startButtonText}>Start Work</Text>
          </TouchableOpacity>
        </View>
      )}

      {isWorkStarted && !closureReport && (
        <View style={styles.bottomBar}>
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity 
              style={styles.updateButton} 
              onPress={handleDailyUpdate}
            >
              <Ionicons name="camera" size={20} color={RSA.blue} />
              <Text style={styles.updateButtonText}>Daily Update</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.completeButton} 
              onPress={handleRequestClosure}
            >
              <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
              <Text style={styles.completeButtonText}>Request Closure</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {closureReport && (
        <View style={styles.bottomBar}>
          <View style={styles.closureStatusCard}>
            <Ionicons 
              name={closureReport.status === 'approved' ? 'checkmark-circle' : 'time'} 
              size={24} 
              color={closureReport.status === 'approved' ? RSA.green : RSA.gold} 
            />
            <Text style={styles.closureStatusText}>
              {closureReport.status === 'approved' 
                ? '✅ Job Completed!' 
                : closureReport.status === 'rejected'
                ? '❌ Changes Requested'
                : '⏳ Awaiting Owner Approval'}
            </Text>
          </View>
        </View>
      )}

      {!canStartWork && !isWorkStarted && (
        <View style={styles.bottomBar}>
          <View style={styles.disabledInfo}>
            <Ionicons name="information-circle" size={20} color={colors.warning[600]} />
            <Text style={styles.disabledText}>
              {!po?.sent_to_vendor_at 
                ? '⏳ Waiting for owner to send PO' 
                : isWaitingForScheduledTime
                ? `⏰ Come back ${timeUntilStart}`
                : 'Not ready yet'}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: '#111827' },
  backButton: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: RSA.blue, borderRadius: 8 },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },

  scrollView: { flex: 1 },

  timelineContainer: { 
    backgroundColor: '#FFFFFF', 
    padding: 20, 
    marginHorizontal: 16, 
    marginTop: 16, 
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timelineTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16, textAlign: 'center' },
  timelineBar: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  timelineStep: { flex: 1, height: 6, backgroundColor: colors.gray[200], borderRadius: 3 },
  timelineStepComplete: { backgroundColor: RSA.green },
  timelineStepActive: { backgroundColor: RSA.blue },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineLabel: { fontSize: 11, color: colors.gray[500], fontWeight: '600' },
  timelineLabelComplete: { fontSize: 11, color: RSA.green, fontWeight: '700' },
  timelineLabelActive: { fontSize: 11, color: RSA.blue, fontWeight: '700' },

  nextStepCard: {
    backgroundColor: RSA.gold + '15',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: RSA.gold,
  },
  nextStepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  nextStepTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  nextStepText: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  nextStepSubtext: { fontSize: 14, color: '#6b7280' },

  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },

  timingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  timingInfo: { flex: 1 },
  timingLabel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  timingValue: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  timingCountdown: { fontSize: 14, fontWeight: '600', color: RSA.blue },
  timingDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 16 },

  earningsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: RSA.green + '15',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: RSA.green,
  },
  earningsInfo: { flex: 1 },
  earningsLabel: { fontSize: 14, color: '#6b7280', marginBottom: 4 },
  earningsAmount: { fontSize: 28, fontWeight: '700', color: RSA.green, marginBottom: 2 },
  earningsSubtext: { fontSize: 12, color: '#6b7280' },

  propertyCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  propertyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.success[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  propertyInfo: { flex: 1 },
  propertyTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  propertyAddress: { fontSize: 14, color: '#6b7280', marginBottom: 2 },
  propertyCity: { fontSize: 13, color: '#9ca3af' },

  poCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  poIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.info[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  poInfo: { flex: 1 },
  poLabel: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  poNumber: { fontSize: 16, fontWeight: '700', color: '#111827' },

  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  jobTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  jobDescription: { fontSize: 15, color: '#374151', lineHeight: 22 },

  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: RSA.blue,
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  updateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: RSA.blue,
    paddingVertical: 14,
    borderRadius: 12,
  },
  updateButtonText: { fontSize: 15, fontWeight: '700', color: RSA.blue },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: RSA.green,
    paddingVertical: 14,
    borderRadius: 12,
  },
  completeButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  
  disabledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.warning[50],
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  disabledText: { fontSize: 14, fontWeight: '600', color: colors.warning[700] },

  // Progress Updates
  updateCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  updateDate: { fontSize: 14, fontWeight: '600', color: '#111827' },
  updateDay: { fontSize: 12, fontWeight: '600', color: RSA.blue, backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  updateNotes: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
  updatePhotos: { fontSize: 12, color: '#6b7280', marginTop: 8 },

  // Closure Status
  closureCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  closureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  closureStatus: { fontSize: 18, fontWeight: '700', color: '#111827' },
  closureNotes: { fontSize: 14, color: '#4b5563', lineHeight: 20, marginBottom: 12 },
  rejectionCard: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: RSA.red,
  },
  rejectionLabel: { fontSize: 12, fontWeight: '700', color: RSA.red, marginBottom: 4 },
  rejectionReason: { fontSize: 14, color: '#991b1b' },
  closureStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  closureStatusText: { fontSize: 15, fontWeight: '700', color: '#111827' },
});
