# 🤖 AI Coding Standards for Lala Rente

## Overview
This document provides comprehensive guidelines for AI-assisted coding in the Lala Rente project. These standards ensure consistent, error-free, and maintainable code generation.

## 🚨 **CRITICAL AI RULES**

### **Before ANY Code Generation:**
1. **Run Type Check**: `npx tsc --noEmit`
2. **Run Lint Check**: `npm run lint`
3. **Check Database Schema**: Use Supabase MCP to verify table structure
4. **Review Existing Code**: Check similar implementations in the codebase
5. **Validate Requirements**: Ensure the solution matches the user's request

### **After ANY Code Generation:**
1. **Validate TypeScript**: Ensure no type errors
2. **Validate ESLint**: Ensure no linting errors
3. **Test Functionality**: Verify the code works as expected
4. **Check Mobile Compatibility**: Ensure mobile-first design
5. **Document Changes**: Explain what was changed and why

## 📋 **AI Code Generation Checklist**

### **TypeScript Standards**
- [ ] **No `any` types**: Use proper TypeScript types
- [ ] **Explicit return types**: Functions must have return type annotations
- [ ] **Proper null checks**: Use optional chaining and nullish coalescing
- [ ] **Interface definitions**: Create proper interfaces for complex objects
- [ ] **Generic types**: Use generics for reusable components
- [ ] **Enum usage**: Use enums for fixed value sets

### **React Standards**
- [ ] **Proper hooks usage**: Follow React hooks rules
- [ ] **Dependency arrays**: Include all dependencies in useEffect
- [ ] **Key props**: Add unique keys to list items
- [ ] **Error boundaries**: Include error handling
- [ ] **Loading states**: Handle loading and error states
- [ ] **Accessibility**: Include ARIA labels and roles

### **Database Standards**
- [ ] **RLS compliance**: Follow Row Level Security patterns
- [ ] **Type safety**: Use typed Supabase client
- [ ] **Error handling**: Handle database errors gracefully
- [ ] **Optimistic updates**: Update UI before server response
- [ ] **Data validation**: Validate data before database operations

### **UI/UX Standards**
- [ ] **Mobile-first**: Design for mobile devices first
- [ ] **Tailwind classes**: Use existing Tailwind configuration
- [ ] **Consistent spacing**: Follow existing spacing patterns
- [ ] **Loading states**: Show loading indicators
- [ ] **Error states**: Display user-friendly error messages
- [ ] **Empty states**: Handle empty data gracefully

## 🎯 **Code Generation Patterns**

### **Component Generation**
```typescript
// ✅ Good AI Pattern
interface ComponentProps {
  // Explicit prop types
  title: string
  onAction: (id: string) => void
  isLoading?: boolean
}

export default function Component({ title, onAction, isLoading = false }: ComponentProps) {
  // Proper hooks usage
  const [state, setState] = useState<string>('')
  
  // Proper error handling
  const handleAction = useCallback(async (id: string) => {
    try {
      await onAction(id)
    } catch (error) {
      console.error('Action failed:', error)
      // Show user-friendly error
    }
  }, [onAction])

  // Proper loading state
  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="mobile-optimized-classes">
      {/* Proper accessibility */}
      <h1 aria-label={title}>{title}</h1>
      {/* Proper event handling */}
      <button onClick={() => handleAction('id')} data-testid="action-button">
        Action
      </button>
    </div>
  )
}
```

### **Database Query Generation**
```typescript
// ✅ Good AI Pattern
const fetchData = async (userId: string): Promise<Data[]> => {
  try {
    // Type-safe query with proper error handling
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    return data || []
  } catch (error) {
    console.error('Failed to fetch data:', error)
    throw error
  }
}
```

### **Form Handling Generation**
```typescript
// ✅ Good AI Pattern
interface FormData {
  name: string
  email: string
  phone?: string
}

export default function Form() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: ''
  })
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = (data: FormData): Partial<FormData> => {
    const newErrors: Partial<FormData> = {}
    
    if (!data.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (!data.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(data.email)) {
      newErrors.email = 'Email is invalid'
    }
    
    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm(formData)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      // Submit logic here
      await submitForm(formData)
    } catch (error) {
      console.error('Form submission failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Form fields with proper validation */}
    </form>
  )
}
```

## 🚫 **Common AI Mistakes to Avoid**

### **TypeScript Mistakes**
```typescript
// ❌ Bad AI Pattern
function processData(data: any) {  // Never use 'any'
  return data.value  // Unsafe access
}

// ✅ Good AI Pattern
function processData(data: { value: string }): string {
  return data.value
}
```

### **React Mistakes**
```typescript
// ❌ Bad AI Pattern
useEffect(() => {
  fetchData(userId)  // Missing dependency
}, [])

// ✅ Good AI Pattern
useEffect(() => {
  fetchData(userId)
}, [userId])  // Include all dependencies
```

### **Database Mistakes**
```typescript
// ❌ Bad AI Pattern
const result = await supabase.from('users').select('*').eq('id', user?.id)  // Unsafe

// ✅ Good AI Pattern
if (!user?.id) return
const result = await supabase.from('users').select('*').eq('id', user.id)
```

## 🔧 **AI Validation Commands**

### **Before Code Generation:**
```bash
# Check current state
npx tsc --noEmit
npm run lint
npm run check-all
```

### **After Code Generation:**
```bash
# Validate generated code
npx tsc --noEmit
npm run lint
npm run lint:fix  # Auto-fix if possible
```

## 📚 **AI Learning Resources**

### **TypeScript Best Practices**
- Use strict mode settings
- Prefer interfaces over types for objects
- Use union types for multiple possibilities
- Use generics for reusable code
- Avoid `any` type at all costs

### **React Best Practices**
- Use functional components with hooks
- Follow hooks rules strictly
- Use proper dependency arrays
- Handle loading and error states
- Use proper key props for lists

### **Database Best Practices**
- Always use typed Supabase client
- Handle errors gracefully
- Use proper RLS patterns
- Validate data before operations
- Use optimistic updates when appropriate

## 🎯 **AI Success Metrics**

### **Code Quality Metrics**
- **Zero TypeScript errors**: All generated code must pass type checking
- **Zero ESLint errors**: All generated code must pass linting
- **100% type coverage**: No `any` types allowed
- **Proper error handling**: All async operations must handle errors
- **Mobile compatibility**: All UI must be mobile-first

### **Functionality Metrics**
- **Working features**: All generated code must work as expected
- **Proper validation**: Forms and inputs must be validated
- **Loading states**: All async operations must show loading states
- **Error states**: All errors must be handled gracefully
- **Accessibility**: All UI must be accessible

## 🆘 **AI Emergency Procedures**

### **When AI Generates Bad Code:**
1. **Stop immediately**: Don't continue with broken code
2. **Run validation**: Check for TypeScript/ESLint errors
3. **Fix errors**: Address all errors before proceeding
4. **Test functionality**: Verify the code works
5. **Document issues**: Note what went wrong and how it was fixed

### **When AI Gets Stuck:**
1. **Check existing code**: Look for similar implementations
2. **Review documentation**: Check project docs and guides
3. **Ask for clarification**: Request more specific requirements
4. **Break down the task**: Split complex tasks into smaller parts
5. **Use simpler approach**: Sometimes simpler is better

## 📝 **AI Documentation Requirements**

### **For Every Code Change:**
- **What was changed**: Clear description of modifications
- **Why it was changed**: Explanation of the reasoning
- **How to test**: Steps to verify the changes work
- **Potential issues**: Any known limitations or considerations
- **Rollback steps**: How to revert if needed

### **For New Features:**
- **Feature overview**: What the feature does
- **Usage examples**: How to use the new functionality
- **Configuration options**: Any settings or parameters
- **Dependencies**: What other parts of the system are affected
- **Testing requirements**: What needs to be tested

---

**Remember: AI should make development faster and more reliable, not create more problems. Follow these standards to ensure consistent, high-quality code generation!** 🚀
