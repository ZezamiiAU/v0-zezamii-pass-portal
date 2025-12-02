"use client"

import type React from "react"
import * as XLSX from "xlsx"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, CheckCircle2, Download, FileJson, FileSpreadsheet } from "lucide-react"
import { validateConfiguration } from "./actions"
import { excelDataToJson } from "@/lib/utils/excel-converter"

export default function ConfigUploadPage() {
  const { toast } = useToast()
  const [jsonInput, setJsonInput] = useState("")
  const [validationResult, setValidationResult] = useState<"success" | "failed" | null>("failed")
  const [isProcessing, setIsProcessing] = useState(false)
  const [validatedConfig, setValidatedConfig] = useState<any>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [generatedSQL, setGeneratedSQL] = useState<string>("")

  const handleDownloadJSONTemplate = () => {
    const template = {
      organisation: {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Example Organisation",
        slug: "example-org",
        logo_url: "https://example.com/logo.png",
        primary_color: "#1a73e8",
        secondary_color: "#34a853",
        contact_email: "contact@example.com",
        contact_phone: "+1234567890",
        support_email: "support@example.com",
        address: "123 Main St",
        city: "City",
        state: "State",
        country: "Country",
        postal_code: "12345",
        timezone: "America/New_York",
        is_active: true,
        stripe_account_id: "",
        notes: "",
      },
      sites: [
        {
          id: "00000000-0000-0000-0000-000000000002",
          organisation_id: "00000000-0000-0000-0000-000000000001",
          name: "Main Site",
          slug: "main-site",
          address: "456 Site Ave",
          city: "City",
          state: "State",
          country: "Country",
          postal_code: "12345",
          timezone: "America/New_York",
          is_active: true,
          notes: "",
        },
      ],
      buildings: [
        {
          id: "00000000-0000-0000-0000-000000000003",
          site_id: "00000000-0000-0000-0000-000000000002",
          name: "Building A",
          address: "",
          floors: 5,
          is_active: true,
          notes: "",
        },
      ],
      floors: [
        {
          id: "00000000-0000-0000-0000-000000000004",
          building_id: "00000000-0000-0000-0000-000000000003",
          name: "Floor 1",
          level: 1,
          is_active: true,
          notes: "",
        },
      ],
      devices: [
        {
          id: "00000000-0000-0000-0000-000000000005",
          org_id: "00000000-0000-0000-0000-000000000001",
          floor_id: "00000000-0000-0000-0000-000000000004",
          area_id: "",
          name: "Main Entrance",
          category: "door",
          status: "active",
          code: "",
          serial: "DEVICE001",
          customer_name: "",
          work_order_ref: "",
          customer_id: "",
          slug: "main-entrance",
          slug_is_active: true,
          custom_name: "Main Entrance Access",
          custom_description: "Entry point to the building",
          custom_logo_url: "",
          position: "",
          rotation: 0,
        },
      ],
      passTypes: [
        {
          id: "00000000-0000-0000-0000-000000000006",
          organisation_id: "00000000-0000-0000-0000-000000000001",
          name: "Day Pass",
          description: "24-hour access pass",
          duration_hours: 24,
          price_cents: 1000,
          stripe_product_id: "",
          stripe_price_id: "",
          max_uses: "",
          is_active: true,
          display_order: 1,
          notes: "",
        },
      ],
      integrations: [
        {
          id: "", // Leave empty - will be auto-generated
          organisation_id: "", // Leave empty - will be auto-filled with org_id
          integration_type: "lock_provider",
          name: "Lock Provider Integration",
          credentials: {
            api_key: "YOUR_LOCK_API_KEY_HERE",
          },
          config: {
            base_url: "https://api.lockprovider.com",
            timeout_seconds: 30,
          },
          status: "active",
        },
      ],
    }

    const blob = new Blob([JSON.stringify(template, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "tenant-config-template.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({
      title: "Downloading Template",
      description: "JSON template has been downloaded",
    })
  }

  const handleDownloadExcelTemplate = () => {
    // Sheet 1: Organisation (including sites, buildings, floors)
    const orgData = [
      [
        "Type",
        "Parent_Name",
        "Name",
        "Slug",
        "Address",
        "City",
        "State",
        "Country",
        "Postal_Code",
        "Timezone",
        "Is_Active",
        "Notes",
      ],
      [
        "Organisation",
        "",
        "Zezamii Parks",
        "zezamii-parks",
        "123 Main St",
        "Sydney",
        "NSW",
        "Australia",
        "2000",
        "Australia/Brisbane",
        true,
        "Main organisation",
      ],
      [
        "Site",
        "Zezamii Parks",
        "Big Parks Site",
        "big-parks",
        "456 Park Avenue",
        "Brisbane",
        "QLD",
        "Australia",
        "4000",
        "Australia/Brisbane",
        true,
        "Main park location",
      ],
      ["Building", "Big Parks Site", "Main Entry Building", "", "456 Park Avenue", "", "", "", "", "", true, ""],
      [
        "Floor",
        "Main Entry Building",
        "Ground Floor",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        true,
        "Optional - will auto-generate if not provided",
      ],
    ]

    // Sheet 2: Contacts
    const contactsData = [
      ["Contact_Email", "Contact_Phone", "Support_Email", "Billing_Email"],
      ["contact@zezamii.com.au", "+61 7 3000 0000", "support@zezamii.com.au", "billing@zezamii.com.au"],
    ]

    // Sheet 3: Branding
    const brandingData = [
      ["Logo_URL", "Primary_Color", "Secondary_Color", "Stripe_Account_ID"],
      ["https://example.com/logo.png", "#1a73e8", "#34a853", ""],
    ]

    // Sheet 4: Devices
    const devicesData = [
      [
        "Floor_Name",
        "Name",
        "Slug",
        "Slug_Is_Active",
        "Category",
        "Status",
        "Code",
        "Serial",
        "Lock_ID",
        "Custom_Name",
        "Custom_Description",
        "Custom_Logo_URL",
      ],
      [
        "Ground Floor",
        "Main Entrance Gate",
        "main-entrance",
        true,
        "gate",
        "active",
        "GATE001",
        "SN789012",
        "LOCK-12345",
        "Main Entrance",
        "Primary park entry point",
        "",
      ],
    ]

    // Sheet 5: Passes
    const passesData = [
      [
        "Name",
        "Code",
        "Description",
        "Duration_Minutes",
        "Price_Cents",
        "Max_Uses",
        "Display_Order",
        "Is_Active",
        "Notes",
      ],
      ["Day Pass", "DAY-PASS", "24-hour park access", 1440, 2400, "", 1, true, ""],
    ]

    // Create workbook using XLSX library
    const wb = XLSX.utils.book_new()

    // Add sheets to workbook
    const wsOrg = XLSX.utils.aoa_to_sheet(orgData)
    const wsContacts = XLSX.utils.aoa_to_sheet(contactsData)
    const wsBranding = XLSX.utils.aoa_to_sheet(brandingData)
    const wsDevices = XLSX.utils.aoa_to_sheet(devicesData)
    const wsPasses = XLSX.utils.aoa_to_sheet(passesData)

    XLSX.utils.book_append_sheet(wb, wsOrg, "Organisation")
    XLSX.utils.book_append_sheet(wb, wsContacts, "Contacts")
    XLSX.utils.book_append_sheet(wb, wsBranding, "Branding")
    XLSX.utils.book_append_sheet(wb, wsDevices, "Devices")
    XLSX.utils.book_append_sheet(wb, wsPasses, "Passes")

    // Write to binary string and create blob
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    // Download file
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "tenant-config-template.xlsx"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Downloading Template",
      description: "Excel template with Lock_ID field - IDs auto-generated on upload based on names",
    })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls")

    if (isExcel) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: "array" })

          // Parse all sheets into a proper structure
          const sheets: { [sheetName: string]: any[] } = {}
          workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName]
            sheets[sheetName] = XLSX.utils.sheet_to_json(sheet)
          })

          // Convert Excel data to proper TenantConfig JSON structure
          const tenantConfig = excelDataToJson(sheets)

          // Format and set the JSON input
          const formattedJSON = JSON.stringify(tenantConfig, null, 2)
          setJsonInput(formattedJSON)

          toast({
            title: "Excel File Loaded",
            description: `${file.name} has been converted to JSON successfully`,
          })
        } catch (error) {
          console.error("[v0] Excel parse error:", error)
          toast({
            title: "Excel Parse Error",
            description: `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
            variant: "destructive",
          })
        }
      }
      reader.onerror = () => {
        toast({
          title: "File Read Error",
          description: "Failed to read the Excel file. Please try again.",
          variant: "destructive",
        })
      }
      reader.readAsArrayBuffer(file)
    } else {
      // For JSON files, read as text with UTF-8 encoding
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setJsonInput(content)
        toast({
          title: "File Loaded",
          description: `${file.name} has been loaded successfully`,
        })
      }
      reader.onerror = () => {
        toast({
          title: "File Read Error",
          description: "Failed to read the file. Please try again.",
          variant: "destructive",
        })
      }
      reader.readAsText(file, "UTF-8")
    }

    // Clear the file input to allow re-uploading the same file
    event.target.value = ""
  }

  const handleValidate = async () => {
    setIsProcessing(true)
    setValidationResult(null)
    setValidatedConfig(null)

    if (!jsonInput.trim()) {
      toast({
        title: "No Configuration Data",
        description: "Please paste your configuration JSON or download the template to get started.",
        variant: "destructive",
        duration: 5000,
      })
      setValidationErrors(["No JSON input provided. Please paste configuration data."])
      setValidationResult("failed")
      setIsProcessing(false)
      return
    }

    toast({
      title: "Validating configuration...",
      description: "Processing your configuration data",
    })

    try {
      const result = await validateConfiguration(jsonInput)

      if (!result.success) {
        setValidationErrors(result.errors || ["Unknown validation error"])
        setValidationResult("failed")
        toast({
          title: "Validation Failed",
          description: `Found ${result.errors?.length || 0} error(s)`,
          variant: "destructive",
          duration: 6000,
        })
        return
      }

      // Update the JSON input with processed IDs
      if (result.updatedJSON) {
        setJsonInput(result.updatedJSON)
      }

      setValidatedConfig(result.validatedConfig)
      setValidationResult("success")
      setGeneratedSQL(result.generatedSQL || "")

      toast({
        title: "✓ Configuration Validated Successfully!",
        description: `${result.validatedConfig.organisation.name} configuration is ready. Download SQL below to load into database.`,
        duration: 8000,
      })
    } catch (error) {
      console.error("Validation error:", error)
      setValidationErrors([`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`])
      setValidationResult("failed")
      toast({
        title: "Validation Failed",
        description: "An unexpected error occurred during validation",
        variant: "destructive",
        duration: 6000,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadSQL = () => {
    if (!validationResult || validationResult !== "success" || !generatedSQL) return

    const blob = new Blob([generatedSQL], {
      type: "text/plain",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tenant-setup-${Date.now()}.sql`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({
      title: "Downloading SQL",
      description: "SQL script has been downloaded",
    })
  }

  const handleCopySQL = () => {
    navigator.clipboard
      .writeText(generatedSQL)
      .then(() => {
        toast({
          title: "SQL Copied",
          description: "The SQL script has been copied to your clipboard",
        })
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err)
        toast({
          title: "Copy Failed",
          description: "Failed to copy the SQL script",
          variant: "destructive",
        })
      })
  }

  const handleClearValidation = () => {
    setValidationResult(null)
    setValidatedConfig(null)
    setValidationErrors([])
    setGeneratedSQL("")
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Tenant Configuration Upload</h1>
        <p className="text-muted-foreground mt-2">
          Upload and validate JSON or Excel configuration files to set up new tenants
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Download Templates</CardTitle>
            <CardDescription>Start with a blank template to configure your tenant</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={handleDownloadJSONTemplate}>
                <FileJson className="mr-2 h-4 w-4" />
                Download JSON Template
              </Button>

              <Button variant="outline" onClick={handleDownloadExcelTemplate}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download Excel Template
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Download a pre-filled template with example data. Replace the example values with your actual
              configuration and upload it back to generate the SQL setup script.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload Configuration</CardTitle>
            <CardDescription>
              Paste your tenant configuration JSON, upload a JSON file, or upload an Excel file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => document.getElementById("json-upload")?.click()}>
                <FileJson className="mr-2 h-4 w-4" />
                Upload JSON
              </Button>
              <input id="json-upload" type="file" accept=".json" className="hidden" onChange={handleFileUpload} />

              <Button variant="outline" onClick={() => document.getElementById("excel-upload")?.click()}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Upload Excel
              </Button>
              <input id="excel-upload" type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />

              <Button
                onClick={handleValidate}
                disabled={!jsonInput || isProcessing}
                className={validationResult === "success" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Validate & Generate SQL
              </Button>

              {validationResult === "success" && generatedSQL && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={handleDownloadSQL}
                    variant="outline"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download SQL
                  </Button>
                  <Button
                    onClick={handleCopySQL}
                    variant="outline"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Copy SQL
                  </Button>
                </div>
              )}
            </div>

            <Textarea
              placeholder="Paste your JSON configuration here..."
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
            />
          </CardContent>
        </Card>

        {validationResult && (
          <Card>
            <CardHeader>
              <CardTitle>{validationResult === "success" ? "Validation Passed" : "Validation Failed"}</CardTitle>
            </CardHeader>
            <CardContent>
              {validationResult === "success" && validatedConfig && (
                <div className="space-y-4">
                  <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800 dark:text-green-200">
                      Configuration Validated Successfully!
                    </AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      <div className="mt-2 space-y-1">
                        <p className="font-semibold">{validatedConfig.organisation.name}</p>
                        <div className="text-sm space-y-1">
                          <p>• {validatedConfig.sites?.length || 0} site(s)</p>
                          <p>• {validatedConfig.buildings?.length || 0} building(s)</p>
                          <p>• {validatedConfig.floors?.length || 0} floor(s)</p>
                          <p>• {validatedConfig.devices?.length || 0} device(s)</p>
                          <p>• {validatedConfig.passTypes?.length || 0} pass type(s)</p>
                        </div>
                      </div>
                      <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded border border-green-200 dark:border-green-800">
                        <p className="font-semibold text-sm mb-1">Next Steps:</p>
                        <ol className="text-sm list-decimal list-inside space-y-1">
                          <li>
                            Save file to your{" "}
                            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/scripts</code> folder
                          </li>
                          <li>Run the SQL script in your database</li>
                          <li>Check QR Generator to see your devices</li>
                        </ol>
                      </div>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {validationResult === "failed" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-semibold mb-2">Validation Errors:</div>
                    <ul className="list-disc list-inside space-y-1">
                      {validationErrors.map((error, idx) => (
                        <li key={idx} className="text-sm">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Configuration Schema Reference</CardTitle>
            <CardDescription>Required fields and data structure for tenant configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Required Sections:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>organisation - Company/tenant details</li>
                  <li>sites - Physical locations (min 1)</li>
                  <li>devices - Access control devices (min 1)</li>
                  <li>passTypes - Available pass offerings (min 1)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Optional Sections:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>buildings - Building organisational structure</li>
                  <li>floors - Floor-level organisational structure</li>
                  <li>accesspointSlugs - Custom URL slugs</li>
                  <li>integrations - Third-party integrations</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Key Validations:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>All IDs must be valid UUIDs</li>
                  <li>Foreign key relationships must be valid</li>
                  <li>Slugs must be unique and lowercase with hyphens</li>
                  <li>Email addresses must be valid format</li>
                  <li>URLs must be properly formatted</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Excel Format:</h4>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>One sheet per data type (Organisation, Sites, Buildings, etc.)</li>
                  <li>Column names must match the JSON field names exactly</li>
                  <li>Empty cells are treated as null/undefined</li>
                  <li>Boolean values: TRUE/FALSE or 1/0</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
