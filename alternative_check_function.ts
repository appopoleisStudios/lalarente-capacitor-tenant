// Alternative implementation of checkIdNumberExists using RPC
// This provides a more reliable way to check for duplicate ID numbers

export const checkIdNumberExistsRPC = async (idNumber: string) => {
  try {
    console.log('🔍 Checking for existing ID number (RPC):', idNumber)
    
    // Call the PostgreSQL function via RPC
    const { data, error } = await supabase.rpc('check_id_number_exists_normalized', {
      id_num: idNumber.trim()
    })

    if (error) {
      console.error('❌ Error in RPC ID number check:', error)
      return false
    }

    if (data && data.length > 0) {
      const result = data[0]
      console.log('📊 RPC Results:', {
        id_exists: result.id_exists,
        profile_count: result.profile_count,
        profile_details: result.profile_details
      })

      if (result.id_exists) {
        console.log('🚨 DUPLICATE ID DETECTED via RPC! Blocking registration.')
        console.log('📋 Existing profiles:', result.profile_details)
        return true
      }
    }

    console.log('✅ ID number is unique (RPC), allowing registration.')
    return false
  } catch (error) {
    console.error('❌ Error in RPC ID number check:', error)
    console.log('⚠️ Error occurred during RPC check, blocking registration for safety.')
    return true
  }
}

// Alternative implementation using direct SQL query with proper JSONB operators
export const checkIdNumberExistsDirect = async (idNumber: string) => {
  try {
    console.log('🔍 Checking for existing ID number (Direct):', idNumber)
    
    // Use a more robust query that handles edge cases
    const { data: existingProfiles, error: queryError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, fica_documents, created_at')
      .not('fica_documents', 'is', null)
      .not('fica_documents', 'eq', 'null')
      .not('fica_documents', 'eq', '{}')
      .not('fica_documents->id_number', 'is', null)
      .neq('fica_documents->id_number', '')
      .eq('fica_documents->id_number', idNumber.trim())

    if (queryError) {
      console.error('❌ Error in direct ID number query:', queryError)
      return false
    }

    console.log('📊 Profiles found with ID number', idNumber + ':', existingProfiles?.length || 0)
    
    // Log all found profiles for debugging
    existingProfiles?.forEach((profile, index) => {
      const ficaDoc = profile.fica_documents as any
      console.log(`Profile ${index + 1}:`, {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        id_number: ficaDoc?.id_number,
        created_at: profile.created_at
      })
    })

    const exists = existingProfiles && existingProfiles.length > 0
    console.log('✅ ID number exists:', exists, existingProfiles && existingProfiles.length > 0 ? `(${existingProfiles.length} profiles found)` : '')
    
    if (exists) {
      console.log('🚨 DUPLICATE ID DETECTED! Blocking registration.')
      return true
    }
    
    console.log('✅ ID number is unique, allowing registration.')
    return false
  } catch (error) {
    console.error('❌ Error checking ID number existence:', error)
    console.log('⚠️ Error occurred during ID check, blocking registration for safety.')
    return true
  }
} 