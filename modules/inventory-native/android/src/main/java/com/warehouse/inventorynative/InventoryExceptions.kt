package com.warehouse.inventorynative

/**
 * استثناءات مخصصة للوحدة الأصلية
 */

class DatabaseNotFoundException(message: String) : Exception(message)
class BackupFailedException(message: String, cause: Throwable? = null) : Exception(message, cause)
class RestoreFailedException(message: String, cause: Throwable? = null) : Exception(message, cause)
class ChecksumFailedException(message: String, cause: Throwable? = null) : Exception(message, cause)
