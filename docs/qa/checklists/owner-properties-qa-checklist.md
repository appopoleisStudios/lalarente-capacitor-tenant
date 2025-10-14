# Owner Properties Management - QA Checklist

## Overview
This checklist covers the complete property management system for owners, including property creation, listing, detail views, editing, and image management.

## Test Environment Setup
- [ ] Ensure test owner account exists with proper permissions
- [ ] Verify Supabase Storage bucket `property-images` exists with proper RLS policies
- [ ] Confirm database has sample lease data for occupied properties testing

## Property List Page (`/dashboard/owner/properties`)

### Basic Functionality
- [ ] Page loads without errors
- [ ] "My Properties" title is displayed
- [ ] "+ Add Property" button is visible and functional
- [ ] Properties are loaded and displayed in cards
- [ ] Each property card shows:
  - [ ] Property image (or placeholder if no image)
  - [ ] Property title
  - [ ] Status badge with correct color coding
  - [ ] Address and location
  - [ ] Rent amount formatted correctly
  - [ ] Bedroom/bathroom/parking info (if available)
  - [ ] "View" and "Edit" buttons

### Empty State
- [ ] When no properties exist, empty state is shown
- [ ] Empty state displays "No properties yet" message
- [ ] "Add Property" button is present in empty state
- [ ] Clicking "Add Property" navigates to new property form

### Search and Filter
- [ ] Search input filters properties by title, address, city
- [ ] Status filter dropdown works (All, Available, Occupied, Maintenance, Vacant)
- [ ] Sort dropdown works (Newest, Rent High to Low, Rent Low to High)
- [ ] Filters work in combination
- [ ] Results update in real-time

### Navigation
- [ ] "View" button navigates to property detail page
- [ ] "Edit" button navigates to property edit page
- [ ] Bottom navigation is present and functional

## New Property Form (`/dashboard/owner/properties/new`)

### Form Fields
- [ ] **Required fields** (marked with *):
  - [ ] Title - accepts text input
  - [ ] Address - accepts text input
  - [ ] City - accepts text input
  - [ ] Province/State - accepts text input
  - [ ] Property Type - dropdown with options
  - [ ] Rent Amount - accepts numeric input
- [ ] **Optional fields**:
  - [ ] Description - textarea
  - [ ] Postal Code - text input
  - [ ] Bedrooms - numeric input
  - [ ] Bathrooms - numeric input
  - [ ] Parking Spaces - numeric input
  - [ ] Deposit Amount - numeric input

### Form Validation
- [ ] Form cannot be submitted with empty required fields
- [ ] Error message appears for validation failures
- [ ] Numeric fields accept only valid numbers
- [ ] Form shows loading state during submission

### Form Submission
- [ ] "Create Property" button is clearly labeled with icon
- [ ] Form submits successfully with valid data
- [ ] Success redirects to property detail page
- [ ] Property appears in properties list after creation
- [ ] "Cancel" button returns to previous page

## Property Detail Page (`/dashboard/owner/properties/[id]`)

### Basic Information Display
- [ ] Property title is prominently displayed
- [ ] Property type is shown
- [ ] Status badge is visible with correct color
- [ ] Description is displayed (if provided)
- [ ] Location details (address, city, province, postal code)

### Property Specifications
- [ ] Bedrooms, bathrooms, parking spaces displayed (if provided)
- [ ] Financial details section shows:
  - [ ] Monthly rent with proper currency formatting
  - [ ] Deposit amount (if provided)

### Image Gallery
- [ ] Property images are displayed in gallery
- [ ] Placeholder shown when no images exist
- [ ] Images are properly sized and responsive

### Amenities
- [ ] Amenities are displayed as tags (if provided)
- [ ] Amenities section is hidden when none exist

### Occupancy Information (for occupied properties)
- [ ] "Current Occupancy" section is displayed
- [ ] Tenant information is shown:
  - [ ] Tenant name
  - [ ] Email address
  - [ ] Phone number (if available)
- [ ] Lease information is shown:
  - [ ] Lease start date
  - [ ] Lease end date
  - [ ] Monthly rent from lease
  - [ ] Deposit paid amount
- [ ] Information is displayed in organized, readable format

### Action Buttons
- [ ] "Edit Property Details" button is prominent with icon
- [ ] "Manage Lease" button appears for occupied properties
- [ ] "Back to Properties" button returns to list
- [ ] All buttons are properly styled and functional

## Property Edit Page (`/dashboard/owner/properties/[id]/edit`)

### Form Pre-population
- [ ] All existing property data is pre-filled
- [ ] Form fields match current property values
- [ ] Dropdowns show correct selected values

### Image Management
- [ ] Current images are displayed in grid
- [ ] Remove image button (×) works for each image
- [ ] "Add Photo" upload area is functional
- [ ] Image upload works with various file types
- [ ] Upload progress is indicated
- [ ] Error handling for failed uploads

### Amenities Management
- [ ] Current amenities are displayed as removable tags
- [ ] Add new amenity input and button work
- [ ] Amenities can be removed by clicking ×
- [ ] Duplicate amenities are prevented

### Form Updates
- [ ] All form fields can be modified
- [ ] Status dropdown includes all valid options
- [ ] Property type dropdown includes all valid options
- [ ] Form validation works for updated data

### Save Functionality
- [ ] "Save Changes" button is clearly labeled with icon
- [ ] Changes are saved successfully
- [ ] Success redirects to property detail page
- [ ] Updated information is reflected on detail page
- [ ] Loading state is shown during save

## Mobile Responsiveness

### General Mobile UX
- [ ] All pages are mobile-optimized
- [ ] Touch targets are appropriately sized
- [ ] Text is readable without zooming
- [ ] Forms are easy to fill on mobile
- [ ] Navigation is thumb-friendly

### Image Handling
- [ ] Image upload works on mobile devices
- [ ] Camera access works for photo capture
- [ ] Image gallery is touch-friendly
- [ ] Images display properly on various screen sizes

## Error Handling

### Network Errors
- [ ] Graceful handling of network failures
- [ ] Appropriate error messages displayed
- [ ] Retry mechanisms available where appropriate

### Validation Errors
- [ ] Clear error messages for form validation
- [ ] Errors are displayed near relevant fields
- [ ] Form state is preserved after validation errors

### Permission Errors
- [ ] Proper handling of unauthorized access
- [ ] Clear messaging for permission issues
- [ ] Appropriate redirects for security

## Performance

### Loading States
- [ ] Loading indicators for all async operations
- [ ] Smooth transitions between states
- [ ] No jarring layout shifts

### Image Performance
- [ ] Images load efficiently
- [ ] Proper image compression
- [ ] Lazy loading where appropriate

## Security

### Access Control
- [ ] Only property owners can edit their properties
- [ ] Proper RLS policies are enforced
- [ ] Unauthorized access is prevented

### Data Validation
- [ ] Server-side validation matches client-side
- [ ] SQL injection prevention
- [ ] XSS prevention in user inputs

## Integration Testing

### Database Integration
- [ ] Property creation writes to database correctly
- [ ] Property updates modify database correctly
- [ ] Image URLs are stored properly
- [ ] Lease data is retrieved correctly for occupied properties

### Storage Integration
- [ ] Images upload to Supabase Storage correctly
- [ ] Image URLs are generated properly
- [ ] Image deletion removes files from storage
- [ ] Storage permissions are correctly configured

## Cross-Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

## Accessibility
- [ ] Proper heading hierarchy
- [ ] Alt text for images
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Color contrast meets standards
- [ ] Focus indicators are visible

## Test Data Cleanup
- [ ] Test properties are cleaned up after testing
- [ ] Test images are removed from storage
- [ ] No test data remains in production

## Sign-off
- [ ] All critical functionality works as expected
- [ ] No blocking bugs remain
- [ ] Performance is acceptable
- [ ] Security requirements are met
- [ ] Ready for production deployment

**Tester:** _________________  
**Date:** _________________  
**Status:** [ ] Pass [ ] Fail [ ] Conditional Pass


