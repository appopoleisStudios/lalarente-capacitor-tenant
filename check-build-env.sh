#!/bin/bash

# Environment Check Script for Local Android Builds
# Run this before building to verify your setup

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                        ║${NC}"
echo -e "${BLUE}║     LaLarente - Build Environment Check               ║${NC}"
echo -e "${BLUE}║                                                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Check Node.js
echo -e "${BLUE}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js found: ${NODE_VERSION}${NC}"
    
    # Check version
    MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
    if [ "$MAJOR" -lt 18 ]; then
        echo -e "${YELLOW}⚠️  Node.js version should be 18+ (you have ${NODE_VERSION})${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗ Node.js not found${NC}"
    echo -e "  Install from: https://nodejs.org/"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
echo ""
echo -e "${BLUE}Checking npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm found: ${NPM_VERSION}${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Java
echo ""
echo -e "${BLUE}Checking Java...${NC}"
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1)
    echo -e "${GREEN}✓ Java found: ${JAVA_VERSION}${NC}"
    
    # Check version
    if java -version 2>&1 | grep -q "version \"1[7-9]"; then
        echo -e "${GREEN}  Java version is 17+${NC}"
    elif java -version 2>&1 | grep -q "version \"[2-9][0-9]"; then
        echo -e "${GREEN}  Java version is 17+${NC}"
    else
        echo -e "${YELLOW}⚠️  Java version should be 17+ for best compatibility${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗ Java not found${NC}"
    echo -e "  Install: ${YELLOW}brew install openjdk@17${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Android SDK
echo ""
echo -e "${BLUE}Checking Android SDK...${NC}"
if [ -n "$ANDROID_HOME" ]; then
    echo -e "${GREEN}✓ ANDROID_HOME set: ${ANDROID_HOME}${NC}"
    
    if [ -d "$ANDROID_HOME" ]; then
        echo -e "${GREEN}  Directory exists${NC}"
        
        # Check for platform-tools
        if [ -d "$ANDROID_HOME/platform-tools" ]; then
            echo -e "${GREEN}  ✓ platform-tools found${NC}"
        else
            echo -e "${YELLOW}  ⚠️  platform-tools not found${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
        
        # Check for build-tools
        if [ -d "$ANDROID_HOME/build-tools" ]; then
            echo -e "${GREEN}  ✓ build-tools found${NC}"
        else
            echo -e "${YELLOW}  ⚠️  build-tools not found${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo -e "${RED}  ✗ Directory does not exist${NC}"
        ERRORS=$((ERRORS + 1))
    fi
elif [ -n "$ANDROID_SDK_ROOT" ]; then
    echo -e "${GREEN}✓ ANDROID_SDK_ROOT set: ${ANDROID_SDK_ROOT}${NC}"
    export ANDROID_HOME=$ANDROID_SDK_ROOT
else
    echo -e "${YELLOW}⚠️  ANDROID_HOME not set${NC}"
    
    # Check common locations
    if [ -d "$HOME/Library/Android/sdk" ]; then
        echo -e "${GREEN}  Found Android SDK at: $HOME/Library/Android/sdk${NC}"
        echo -e "${YELLOW}  Add to your shell profile:${NC}"
        echo -e "  ${BLUE}export ANDROID_HOME=~/Library/Android/sdk${NC}"
        echo -e "  ${BLUE}export ANDROID_SDK_ROOT=~/Library/Android/sdk${NC}"
        WARNINGS=$((WARNINGS + 1))
    elif [ -d "$HOME/Android/Sdk" ]; then
        echo -e "${GREEN}  Found Android SDK at: $HOME/Android/Sdk${NC}"
        echo -e "${YELLOW}  Add to your shell profile:${NC}"
        echo -e "  ${BLUE}export ANDROID_HOME=~/Android/Sdk${NC}"
        echo -e "  ${BLUE}export ANDROID_SDK_ROOT=~/Android/Sdk${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${RED}  ✗ Android SDK not found${NC}"
        echo -e "  Install Android Studio or command-line tools"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Check Gradle wrapper
echo ""
echo -e "${BLUE}Checking Gradle wrapper...${NC}"
if [ -f "android/gradlew" ]; then
    echo -e "${GREEN}✓ Gradle wrapper found${NC}"
    
    if [ -x "android/gradlew" ]; then
        echo -e "${GREEN}  Executable permissions set${NC}"
    else
        echo -e "${YELLOW}  ⚠️  Not executable, fixing...${NC}"
        chmod +x android/gradlew
        echo -e "${GREEN}  ✓ Fixed${NC}"
    fi
else
    echo -e "${RED}✗ Gradle wrapper not found at android/gradlew${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check ADB (optional)
echo ""
echo -e "${BLUE}Checking ADB (optional)...${NC}"
if command -v adb &> /dev/null; then
    ADB_VERSION=$(adb version | head -n 1)
    echo -e "${GREEN}✓ ADB found: ${ADB_VERSION}${NC}"
    
    # Check for connected devices
    DEVICES=$(adb devices | grep -v "List" | grep "device$" | wc -l)
    if [ "$DEVICES" -gt 0 ]; then
        echo -e "${GREEN}  ${DEVICES} device(s) connected${NC}"
    else
        echo -e "${YELLOW}  No devices connected${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  ADB not found (optional, for device installation)${NC}"
    echo -e "  Add to PATH: ${BLUE}\$ANDROID_HOME/platform-tools${NC}"
fi

# Check project dependencies
echo ""
echo -e "${BLUE}Checking project setup...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ node_modules exists${NC}"
else
    echo -e "${YELLOW}⚠️  node_modules not found${NC}"
    echo -e "  Run: ${BLUE}npm install${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f "package.json" ]; then
    echo -e "${GREEN}✓ package.json found${NC}"
else
    echo -e "${RED}✗ package.json not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "android/app/build.gradle" ]; then
    echo -e "${GREEN}✓ Android build.gradle found${NC}"
else
    echo -e "${RED}✗ Android build.gradle not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check assets directory
if [ -d "android/app/src/main/assets" ]; then
    echo -e "${GREEN}✓ Assets directory exists${NC}"
else
    echo -e "${YELLOW}⚠️  Assets directory not found (will be created)${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                        ║${NC}"
    echo -e "${GREEN}║              ✅ ALL CHECKS PASSED!                      ║${NC}"
    echo -e "${GREEN}║                                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Your environment is ready to build!${NC}"
    echo ""
    echo -e "${BLUE}Run the build:${NC}"
    echo -e "  ${YELLOW}./build-client-test.sh${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                                                        ║${NC}"
    echo -e "${YELLOW}║         ⚠️  WARNINGS FOUND (${WARNINGS})                        ║${NC}"
    echo -e "${YELLOW}║                                                        ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}You can proceed, but consider fixing the warnings above.${NC}"
    echo ""
    echo -e "${BLUE}Run the build:${NC}"
    echo -e "  ${YELLOW}./build-client-test.sh${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                                                        ║${NC}"
    echo -e "${RED}║         ❌ ERRORS FOUND (${ERRORS})                            ║${NC}"
    echo -e "${RED}║                                                        ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Please fix the errors above before building.${NC}"
    echo ""
    echo -e "${BLUE}Common fixes:${NC}"
    echo -e "  Install Java 17+:     ${YELLOW}brew install openjdk@17${NC}"
    echo -e "  Set ANDROID_HOME:     ${YELLOW}export ANDROID_HOME=~/Library/Android/sdk${NC}"
    echo -e "  Install dependencies: ${YELLOW}npm install${NC}"
    exit 1
fi
